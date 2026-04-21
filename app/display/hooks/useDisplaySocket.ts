import {
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
  useCallback,
} from "react";
import { socket } from "@/shared/socket";
import {
  getDisplayRoom,
  getAllPlayerRooms,
  type PlayerSlot,
} from "@/lib/room";
import { getRouletteRadius } from "../three/Scene";
import {
  clamp,
  getHitScoreFromAim as getHitScoreFromAimBase,
  DEFAULT_ROULETTE_RADIUS,
} from "@/lib/score";
import { isAimInsideDisplayBounds } from "@/lib/displayAimBounds";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

type PlayerScore = {
  socketId?: string;
  serverName?: string;
  slot?: PlayerSlot;
  name: string;
  score: number;
  isConnected: boolean;
  isReady: boolean;
  totalThrows: number;
  currentThrows: number;
};

interface UseDisplaySocketProps {
  room: string;
  onLog?: (msg: string) => void;
  setAimPositions: Dispatch<SetStateAction<AimState>>;
  setPlayers: Dispatch<SetStateAction<Map<string, PlayerScore>>>;
  setPlayerOrder: Dispatch<SetStateAction<string[]>>;
  players: Map<string, PlayerScore>;
  onPlayerFinish?: (name: string, score: number) => void;
}

function getCurrentRouletteRadius(): number {
  const radius = getRouletteRadius();
  if (Number.isFinite(radius) && radius > 0) {
    return radius;
  }
  return DEFAULT_ROULETTE_RADIUS;
}

function getHitScoreFromAim(aim?: { x: number; y: number }): number {
  return getHitScoreFromAimBase(aim, getCurrentRouletteRadius());
}

function resolvePlayerKey(data: {
  playerId?: string;
  name?: string;
  socketId?: string;
}) {
  return data.socketId || data.playerId || data.name || "player";
}

function stripDisplayName(name: string) {
  const [base] = name.split("#");
  return base || name;
}

function buildRanking(players: PlayerScore[]) {
  return [...players]
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({
      name: player.name,
      score: player.score,
      rank: index + 1,
    }));
}

export function useDisplaySocket({
  room,
  onLog,
  setAimPositions,
  setPlayers,
  setPlayerOrder,
  players,
  onPlayerFinish,
}: UseDisplaySocketProps) {
  const playersRef = useRef(players);
  const onPlayerFinishRef = useRef(onPlayerFinish);
  const gameFinishedEmittedRef = useRef(false);

  // React state 비동기 반영 경쟁 조건 방지: 점수를 ref로 동기 추적
  const playerScoresRef = useRef<Map<string, { name: string; score: number }>>(new Map());

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    onPlayerFinishRef.current = onPlayerFinish;
  }, [onPlayerFinish]);

  const emitFinishGame = useCallback(
    (targetRoom: string, finishedPlayers: PlayerScore[]) => {
      socket.emit("finish-game", {
        room: targetRoom,
        scores: finishedPlayers.map((player) => ({
          socketId: player.socketId ?? player.serverName ?? player.name,
          name: player.name,
          score: player.score,
        })),
      });
    },
    []
  );

  const CLEAR_DARTS_DELAY_MS = 3000;

  useEffect(() => {
    if (!room) return;

    const displayRoom = getDisplayRoom(room);
    const playerRooms = getAllPlayerRooms(room);
    const playerRoomSet = new Set(playerRooms);
    const isPlayerRoomEvent = (roomName?: string) =>
      !roomName || playerRoomSet.has(roomName);

    const logPlayerCount = (
      label: string,
      data: { room: string; playerCount: number }
    ) => {
      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      onLog?.(`${label}: ${data.room}, Players: ${actualPlayerCount}`);
    };

    if (!socket.connected) {
      socket.io.opts.query = { room, name: "_display" };
      socket.connect();
    }

    const onConnect = () => {
      onLog?.(`Socket connected: ${socket.id}`);

      socket.emit("joinRoom", { room: displayRoom, name: "_display" });
      onLog?.(`Joined display room: ${displayRoom}`);

      playerRooms.forEach((playerRoom) => {
        socket.emit("joinRoom", { room: playerRoom, name: "_display" });
        onLog?.(`Subscribed to player room: ${playerRoom}`);
      });
    };

    const onClientInfo = (data: {
      socketId: string;
      name: string;
      room: string;
    }) => {
      onLog?.(`Client info: ${data.socketId}, ${data.name}, ${data.room}`);
    };

    const onJoinedRoom = (data: { room: string; playerCount: number }) => {
      logPlayerCount("Room joined", data);
    };

    const onRoomPlayerCount = (data: { room: string; playerCount: number }) => {
      logPlayerCount("Player count", data);
    };

    const onDartThrown = (data: {
      room: string;
      name?: string;
      socketId?: string;
      skin?: string;
      aim: { x: number; y: number };
      score: number;
    }) => {
      if (!isPlayerRoomEvent(data.room)) return;

      const key = resolvePlayerKey(data);
      if (!playersRef.current.has(key)) {
        onLog?.(`Ignored dart from unknown player ${key}`);
        return;
      }

      const isInsideBounds = isAimInsideDisplayBounds(data.aim);
      const score = isInsideBounds ? getHitScoreFromAim(data.aim) : 0;
      const hitSound = new Audio("/sound/hit.mp3");
      hitSound.play().catch((e) => {
        onLog?.(`Sound play failed: ${String(e)}`);
      });

      setAimPositions((prev) => {
        const next = new Map(prev);
        next.set(key, { x: data.aim.x, y: data.aim.y, skin: data.skin });
        return next;
      });

      setPlayers((prev) => {
        const next = new Map(prev);
        const player = prev.get(key);

        if (player) {
          const newCurrentThrows = player.currentThrows + 1;
          const isLastThrow = newCurrentThrows >= 3;
          const newScore = player.score + score;

          // React 상태 반영 전 onAimOff가 먼저 실행되는 경쟁 조건 방지
          playerScoresRef.current.set(key, { name: player.name, score: newScore });

          next.set(key, {
            ...player,
            score: newScore,
            totalThrows: player.totalThrows + 1,
            currentThrows: isLastThrow ? 0 : newCurrentThrows,
          });
          onLog?.(
            `Score: ${player.name} ${player.score} -> ${newScore} (Throw ${newCurrentThrows}/3)`
          );
        }

        return next;
      });

      window.dispatchEvent(
        new CustomEvent("DART_THROW", { detail: { ...data, score } })
      );
    };

    const onAimUpdate = (data: {
      room?: string;
      playerId?: string;
      name?: string;
      socketId?: string;
      skin?: string;
      registration?: boolean;
      aim: { x: number; y: number };
    }) => {
      if (!isPlayerRoomEvent(data.room)) return;

      const key = resolvePlayerKey(data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);
      const displayName = data.name ? stripDisplayName(data.name) : key;
      const slotIndex = data.room ? playerRooms.indexOf(data.room) : -1;
      const slot =
        slotIndex >= 0 ? ((slotIndex + 1) as PlayerSlot) : undefined;
      const isRegistration = data.registration === true;

      if (key && key !== "_display") {
        if (isRegistration) {
          gameFinishedEmittedRef.current = false;
        }
        let shouldUpdateAim = !isRegistration;
        let addedPlayer = false;

        setPlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(key);

          if (existing) {
            if (!existing.isReady && existing.totalThrows >= 3) {
              shouldUpdateAim = false;
              return prev;
            }
            next.set(key, {
              ...existing,
              slot: slot ?? existing.slot,
              isConnected: true,
              isReady: isRegistration ? existing.isReady : true,
              socketId: data.socketId ?? existing.socketId,
              serverName: data.name ?? existing.serverName,
              name: displayName ?? existing.name,
            });
            return next;
          }

          if (!prev.has(key)) {
            next.set(key, {
              socketId: data.socketId,
              serverName: data.name,
              slot,
              name: displayName,
              score: 0,
              isConnected: true,
              isReady: !isRegistration,
              totalThrows: 0,
              currentThrows: 0,
            });
            addedPlayer = true;
            return next;
          }

          return next;
        });

        if (addedPlayer) {
          setPlayerOrder((prev) => {
            if (prev.includes(key)) return prev;
            return [...prev, key];
          });
        }

        if (shouldUpdateAim) {
          setAimPositions((prev) => {
            const next = new Map(prev);
            next.set(key, { x, y, skin: data.skin });
            return next;
          });
        }
      }
    };

    const onAimOff = (data: {
      room?: string;
      playerId?: string;
      name?: string;
      socketId?: string;
    }) => {
      if (!isPlayerRoomEvent(data.room)) return;

      const key = resolvePlayerKey(data);
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      if (key !== "_display") {
        // throw-dart와 aim-off가 같은 JS 태스크에서 처리될 경우 playersRef가 stale할 수 있으므로
        // 동기적으로 누적한 playerScoresRef 값을 우선 사용
        const tracked = playerScoresRef.current.get(key);
        const basePlayer = playersRef.current.get(key);
        const finishedName = tracked?.name ?? basePlayer?.name;
        const finishedScore = tracked?.score ?? basePlayer?.score ?? 0;
        playerScoresRef.current.delete(key);
        const nextPlayers = new Map(playersRef.current);
        const player = nextPlayers.get(key);
        if (player) {
          nextPlayers.set(key, {
            ...player,
            score: finishedScore,
            isConnected: false,
            isReady: false,
            totalThrows: Math.max(player.totalThrows, 3),
            currentThrows: 0,
          });
          onLog?.(`Aim off: ${key}`);
        }

        playersRef.current = nextPlayers;
        setPlayers(nextPlayers);

        const registeredPlayers = Array.from(nextPlayers.values()).filter(
          (registeredPlayer) => registeredPlayer.slot
        );
        const finishedPlayers =
          registeredPlayers.length > 0 &&
          registeredPlayers.every(
            (registeredPlayer) => registeredPlayer.totalThrows >= 3
          )
            ? registeredPlayers
            : null;

        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("CLEAR_PLAYER_DARTS", { detail: { key } })
          );
        }, CLEAR_DARTS_DELAY_MS);

        if (basePlayer && finishedName) {
          onPlayerFinishRef.current?.(finishedName, finishedScore);
        }
        if (
          data.room &&
          finishedPlayers &&
          !gameFinishedEmittedRef.current
        ) {
          gameFinishedEmittedRef.current = true;
          emitFinishGame(data.room, finishedPlayers);
          window.dispatchEvent(
            new CustomEvent("GAME_FINISHED", {
              detail: {
                room: data.room,
                ranking: buildRanking(finishedPlayers),
              },
            })
          );
        }
      }
    };

    const onGameResult = (data: {
      results: {
        [socketId: string]: {
          result: "win" | "lose" | "tie";
          score: number;
          rank: number;
          totalPlayers: number;
          ranking: Array<{
            name: string;
            score: number;
            rank: number;
          }>;
        };
      };
      ranking: Array<{
        socketId: string;
        name: string;
        score: number;
        rank: number;
      }>;
    }) => {
      onLog?.(`Game result received`);
      onLog?.(`Total players: ${data.ranking.length}`);

      data.ranking.forEach((player) => {
        onLog?.(
          `Rank ${player.rank}: ${player.name} - ${player.score}점 (socketId: ${player.socketId})`
        );
      });

      window.dispatchEvent(new CustomEvent("GAME_RESULT", { detail: data }));
    };

    const onGameFinished = (data: {
      room: string;
      ranking: Array<{
        name: string;
        score: number;
        rank: number;
      }>;
    }) => {
      onLog?.(`Game finished in room: ${data.room}`);
      onLog?.(`Final ranking:`);

      data.ranking.forEach((player) => {
        onLog?.(`  ${player.rank}위: ${player.name} - ${player.score}점`);
      });

      window.dispatchEvent(new CustomEvent("GAME_FINISHED", { detail: data }));
    };

    const onResetQueue = () => {
      window.dispatchEvent(new CustomEvent("RESET_SCENE"));
    };

    socket.on("connect", onConnect);
    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);
    socket.on("dart-thrown", onDartThrown);
    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("game-result", onGameResult);
    socket.on("game-finished", onGameFinished);
    socket.on("reset-queue", onResetQueue);

    return () => {
      socket.off("connect", onConnect);
      socket.off("clientInfo", onClientInfo);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomPlayerCount", onRoomPlayerCount);
      socket.off("dart-thrown", onDartThrown);
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("game-result", onGameResult);
      socket.off("game-finished", onGameFinished);
      socket.off("reset-queue", onResetQueue);
    };
  }, [
    room,
    onLog,
    setAimPositions,
    setPlayers,
    setPlayerOrder,
    emitFinishGame,
  ]);

  return {};
}
