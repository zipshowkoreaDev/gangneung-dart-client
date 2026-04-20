import {
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
  useCallback,
} from "react";
import { socket } from "@/shared/socket";
import { getDisplayRoom, getAllPlayerRooms } from "@/lib/room";
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
  setPlayerRoomCounts: Dispatch<SetStateAction<Map<string, number>>>;
  players: Map<string, PlayerScore>;
  playerOrder: string[];
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

export function useDisplaySocket({
  room,
  onLog,
  setAimPositions,
  setPlayers,
  setPlayerOrder,
  setPlayerRoomCounts,
  players,
  playerOrder,
  onPlayerFinish,
}: UseDisplaySocketProps) {
  const playersRef = useRef(players);
  const playerOrderRef = useRef(playerOrder);
  const onPlayerFinishRef = useRef(onPlayerFinish);

  // React state 비동기 반영 경쟁 조건 방지: 점수를 ref로 동기 추적
  const playerScoresRef = useRef<Map<string, { name: string; score: number }>>(new Map());

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    playerOrderRef.current = playerOrder;
  }, [playerOrder]);

  useEffect(() => {
    onPlayerFinishRef.current = onPlayerFinish;
  }, [onPlayerFinish]);

  const emitFinishGame = useCallback(
    (targetRoom: string, player: PlayerScore, socketId?: string) => {
      socket.emit("finish-game", {
        room: targetRoom,
        scores: [
          {
            socketId:
              socketId ?? player.socketId ?? player.serverName ?? player.name,
            name: player.name,
            score: player.score,
          },
        ],
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
      if (!data.room || !playerRoomSet.has(data.room)) return;

      const actualPlayerCount = Math.max(0, data.playerCount - 1);
      setPlayerRoomCounts((prev) => {
        const next = new Map(prev);
        next.set(data.room, actualPlayerCount);
        return next;
      });
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
      aim: { x: number; y: number };
    }) => {
      if (!isPlayerRoomEvent(data.room)) return;

      const key = resolvePlayerKey(data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);
      const displayName = data.name ? stripDisplayName(data.name) : key;

      if (key && key !== "_display") {
        let shouldUpdateAim = true;
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
              isConnected: true,
              isReady: true,
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
              name: displayName,
              score: 0,
              isConnected: true,
              isReady: true,
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

        setPlayers((prev) => {
          const next = new Map(prev);
          const player = prev.get(key);
          if (player) {
            next.set(key, {
              ...player,
              score: finishedScore,
              isConnected: false,
              isReady: false,
              totalThrows: Math.max(player.totalThrows, 3),
              currentThrows: 0,
            });
            onLog?.(`Aim off: ${key}`);
          }
          return next;
        });
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("CLEAR_PLAYER_DARTS", { detail: { key } })
          );
        }, CLEAR_DARTS_DELAY_MS);

        if (data.room && basePlayer && finishedName) {
          emitFinishGame(data.room, { ...basePlayer, name: finishedName, score: finishedScore }, data.socketId);
          onPlayerFinishRef.current?.(finishedName, finishedScore);
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
    setPlayerRoomCounts,
    emitFinishGame,
  ]);

  return {};
}
