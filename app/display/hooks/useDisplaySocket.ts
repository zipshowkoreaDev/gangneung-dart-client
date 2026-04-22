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
  MAX_PLAYERS,
  type PlayerSlot,
} from "@/lib/room";
import { getRouletteRadius } from "../three/Scene";
import {
  clamp,
  getHitScoreFromAim as getHitScoreFromAimBase,
  DEFAULT_ROULETTE_RADIUS,
} from "@/lib/score";
import { isAimInsideDisplayBounds } from "@/lib/displayAimBounds";
import { DART_TIME_LIMIT_MS, TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";
import type { PlayerScore } from "@/app/display/types";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

interface UseDisplaySocketProps {
  room: string;
  onLog?: (msg: string) => void;
  setAimPositions: Dispatch<SetStateAction<AimState>>;
  setPlayers: Dispatch<SetStateAction<Map<string, PlayerScore>>>;
  setPlayerOrder: Dispatch<SetStateAction<string[]>>;
  players: Map<string, PlayerScore>;
  onPlayersFinish?: (
    players: Array<{ name: string; score: number }>,
    gameId?: string
  ) => void;
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

function getSlotPlayerKey(slot?: PlayerSlot) {
  return slot ? `slot-${slot}` : undefined;
}

function getQueuePlayerKey(socketId: string) {
  return `queue-${socketId}`;
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

function getFinishedGamePlayers(
  players: Map<string, PlayerScore>,
  expectedPlayerCount: number
) {
  const slotPlayers = Array.from(players.values()).filter(
    (player) => player.slot
  );

  if (
    slotPlayers.length === 0 ||
    slotPlayers.length < expectedPlayerCount ||
    slotPlayers.some((player) => player.totalThrows < 3)
  ) {
    return null;
  }

  return slotPlayers.sort(
    (a, b) =>
      (a.slot ?? Number.MAX_SAFE_INTEGER) -
      (b.slot ?? Number.MAX_SAFE_INTEGER)
  );
}

export function useDisplaySocket({
  room,
  onLog,
  setAimPositions,
  setPlayers,
  setPlayerOrder,
  players,
  onPlayersFinish,
}: UseDisplaySocketProps) {
  const playersRef = useRef(players);
  const onPlayersFinishRef = useRef(onPlayersFinish);
  const gameFinishedEmittedRef = useRef(false);
  const gameIdRef = useRef(0);
  const finishedPlayerKeysRef = useRef<Set<string>>(new Set());
  const playerAliasKeyRef = useRef<Map<string, string>>(new Map());
  const queuedPlayerIdsRef = useRef<string[]>([]);
  const expectedGamePlayerCountRef = useRef(0);

  // React state 비동기 반영 경쟁 조건 방지: 마지막 점수를 ref로 동기 추적
  const playerLastScoresRef = useRef<Map<string, { name: string; score: number }>>(new Map());

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    onPlayersFinishRef.current = onPlayersFinish;
  }, [onPlayersFinish]);

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

  const QUEUE_STATUS_INTERVAL_MS = 1000;

  useEffect(() => {
    if (!room) return;

    const displayRoom = getDisplayRoom(room);
    const playerRooms = getAllPlayerRooms(room);
    const playerRoomSet = new Set(playerRooms);
    const isPlayerRoomEvent = (roomName?: string) =>
      !roomName || playerRoomSet.has(roomName);
    const getRoomSlot = (roomName?: string): PlayerSlot | undefined => {
      const slotIndex = roomName ? playerRooms.indexOf(roomName) : -1;
      return slotIndex >= 0 ? ((slotIndex + 1) as PlayerSlot) : undefined;
    };
    const resolveDisplayPlayerKey = (data: {
      room?: string;
      playerId?: string;
      name?: string;
      socketId?: string;
    }) => {
      const slotKey = getSlotPlayerKey(getRoomSlot(data.room));
      if (slotKey) return slotKey;

      const aliases = [data.socketId, data.playerId, data.name].filter(
        Boolean
      ) as string[];
      for (const alias of aliases) {
        const mappedKey = playerAliasKeyRef.current.get(alias);
        if (mappedKey) return mappedKey;
      }

      return resolvePlayerKey(data);
    };
    const rememberPlayerAliases = (
      key: string,
      data: {
        playerId?: string;
        name?: string;
        socketId?: string;
      }
    ) => {
      [data.socketId, data.playerId, data.name]
        .filter(Boolean)
        .forEach((alias) => {
          playerAliasKeyRef.current.set(alias as string, key);
        });
    };

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

      socket.emit("status-queue");
    };

    const resetAggregationForNewGame = () => {
      const hasRegisteredPlayers = Array.from(playersRef.current.values()).some(
        (player) => player.slot
      );

      if (!hasRegisteredPlayers || gameFinishedEmittedRef.current) {
            gameIdRef.current += 1;
            playerLastScoresRef.current.clear();
            finishedPlayerKeysRef.current.clear();
            playerAliasKeyRef.current.clear();
            expectedGamePlayerCountRef.current = queuedPlayerIdsRef.current.length;
            gameFinishedEmittedRef.current = false;
            return true;
      }

      return false;
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

    const onStatusQueue = (queue: string[]) => {
      const uniqueQueue = Array.from(new Set(queue)).filter(Boolean);
      queuedPlayerIdsRef.current = uniqueQueue.slice(0, MAX_PLAYERS);
      onLog?.(`Queue players: ${uniqueQueue.length}`);

      setPlayers((prev) => {
        const next = new Map(prev);
        const queueKeys = new Set(
          uniqueQueue.map((socketId) => getQueuePlayerKey(socketId))
        );

        Array.from(next.entries()).forEach(([key, player]) => {
          if (player.isWaiting && !queueKeys.has(key)) {
            next.delete(key);
          }
        });

        uniqueQueue.forEach((socketId, index) => {
          const alreadyRegistered = Array.from(next.values()).some(
            (player) => player.slot && player.socketId === socketId
          );

          if (alreadyRegistered) return;

          const key = getQueuePlayerKey(socketId);
          if (next.has(key)) return;

          next.set(key, {
            socketId,
            name: `대기 ${index + 1}`,
            score: 0,
            isConnected: true,
            isReady: false,
            isWaiting: true,
            totalThrows: 0,
            currentThrows: 0,
            throwScores: [],
            dartDeadlineEndsAt: undefined,
          });
        });

        playersRef.current = next;
        return next;
      });
    };

    const onDartThrown = (data: {
      room: string;
      name?: string;
      socketId?: string;
      skin?: string;
      aim: { x: number; y: number };
      score?: number;
    }) => {
      if (!isPlayerRoomEvent(data.room)) return;

      const key = resolveDisplayPlayerKey(data);
      rememberPlayerAliases(key, data);
      if (finishedPlayerKeysRef.current.has(key)) {
        onLog?.(`Ignored dart from finished player ${key}`);
        return;
      }
      if (!playersRef.current.has(key)) {
        onLog?.(`Ignored dart from unknown player ${key}`);
        return;
      }

      const score = isAimInsideDisplayBounds(data.aim)
        ? getHitScoreFromAim(data.aim)
        : 0;
      const hitSound = new Audio("/sound/hit.mp3");
      hitSound.play().catch((e) => {
        onLog?.(`Sound play failed: ${String(e)}`);
      });

      setAimPositions((prev) => {
        const next = new Map(prev);
        next.set(key, { x: data.aim.x, y: data.aim.y, skin: data.skin });
        return next;
      });

      const nextPlayers = new Map(playersRef.current);
      const player = nextPlayers.get(key);

      if (player) {
        const newCurrentThrows = player.currentThrows + 1;
        const isLastThrow = newCurrentThrows >= 3;
        const newScore = player.score + score;
        const throwScores = [...(player.throwScores ?? []), score].slice(0, 3);
        const turnDelayEndsAt = isLastThrow
          ? Date.now() + TURN_RESULT_DELAY_MS
          : undefined;
        const dartDeadlineEndsAt = isLastThrow
          ? undefined
          : Date.now() + DART_TIME_LIMIT_MS;

        // React 상태 반영 전 onAimOff가 먼저 실행되는 경쟁 조건 방지
        playerLastScoresRef.current.set(key, { name: player.name, score: newScore });

        nextPlayers.set(key, {
          ...player,
          score: newScore,
          totalThrows: player.totalThrows + 1,
          currentThrows: isLastThrow ? 0 : newCurrentThrows,
          throwScores,
          dartDeadlineEndsAt,
          turnDelayEndsAt,
        });
        playersRef.current = nextPlayers;
        setPlayers(nextPlayers);
        onLog?.(
          `Score: ${player.name} ${player.score} + ${score} = ${newScore} (Throw ${newCurrentThrows}/3)`
        );
      }

      window.dispatchEvent(
        new CustomEvent("DART_THROW", {
          detail: { ...data, playerId: key, score },
        })
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

      const key = resolveDisplayPlayerKey(data);
      rememberPlayerAliases(key, data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);
      const displayName = data.name ? stripDisplayName(data.name) : key;
      const slot = getRoomSlot(data.room);
      const isRegistration = data.registration === true;
      const startsNewGame = isRegistration ? resetAggregationForNewGame() : false;

      if (key && key !== "_display") {
        if (startsNewGame) {
          setAimPositions(new Map());
          setPlayerOrder([]);
        }
        let shouldUpdateAim = !isRegistration;
        let addedPlayer = false;

        setPlayers((prev) => {
          const next = startsNewGame ? new Map<string, PlayerScore>() : new Map(prev);
          if (isRegistration && data.socketId) {
            next.delete(getQueuePlayerKey(data.socketId));
          }
          const existing = next.get(key);

          if (existing) {
            if (isRegistration) {
              playerLastScoresRef.current.delete(key);
              finishedPlayerKeysRef.current.delete(key);
              next.set(key, {
                ...existing,
                slot: slot ?? existing.slot,
                isConnected: true,
                isReady: false,
                socketId: data.socketId ?? existing.socketId,
                serverName: data.name ?? existing.serverName,
                name: displayName ?? existing.name,
                score: 0,
                totalThrows: 0,
                currentThrows: 0,
                throwScores: [],
                dartDeadlineEndsAt: undefined,
                turnDelayEndsAt: undefined,
                isWaiting: false,
              });
              playersRef.current = next;
              return next;
            }

            if (!existing.isReady && existing.totalThrows >= 3) {
              shouldUpdateAim = false;
              return prev;
            }
            const isBecomingReady = !existing.isReady && existing.totalThrows < 3;
            next.set(key, {
              ...existing,
              slot: slot ?? existing.slot,
              isConnected: true,
              isReady: isRegistration ? existing.isReady : true,
              socketId: data.socketId ?? existing.socketId,
              serverName: data.name ?? existing.serverName,
              name: displayName ?? existing.name,
              isWaiting: false,
              dartDeadlineEndsAt: isBecomingReady
                ? Date.now() + DART_TIME_LIMIT_MS
                : existing.dartDeadlineEndsAt,
            });
            playersRef.current = next;
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
              isWaiting: false,
              totalThrows: 0,
              currentThrows: 0,
              throwScores: [],
              dartDeadlineEndsAt: isRegistration
                ? undefined
                : Date.now() + DART_TIME_LIMIT_MS,
              turnDelayEndsAt: undefined,
            });
            addedPlayer = true;
            playersRef.current = next;
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
      totalThrows?: number;
    }) => {
      if (!isPlayerRoomEvent(data.room)) return;

      const key = resolveDisplayPlayerKey(data);
      rememberPlayerAliases(key, data);
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      if (key !== "_display") {
        if (finishedPlayerKeysRef.current.has(key)) {
          onLog?.(`Ignored duplicate aim-off: ${key}`);
          return;
        }

        const tracked = playerLastScoresRef.current.get(key);
        const basePlayer = playersRef.current.get(key);
        const reportedThrows = data.totalThrows ?? basePlayer?.totalThrows ?? 0;
        const hasFinishedTurn = reportedThrows >= 3;
        const finishedScore = tracked?.score ?? basePlayer?.score ?? 0;
        playerLastScoresRef.current.delete(key);
        const nextPlayers = new Map(playersRef.current);
        const player = nextPlayers.get(key);

        if (!hasFinishedTurn) {
          if (player) {
            nextPlayers.set(key, {
              ...player,
              isConnected: false,
              isReady: false,
              currentThrows: 0,
              dartDeadlineEndsAt: undefined,
            });
          }
          playersRef.current = nextPlayers;
          setPlayers(nextPlayers);
          onLog?.(`Ignored unfinished aim-off: ${key}`);
          return;
        }

        finishedPlayerKeysRef.current.add(key);
        if (player) {
          nextPlayers.set(key, {
            ...player,
            score: finishedScore,
            isConnected: false,
            isReady: false,
            totalThrows: reportedThrows,
            currentThrows: 0,
            dartDeadlineEndsAt: undefined,
          });
          onLog?.(`Aim off: ${key}`);
        }

        playersRef.current = nextPlayers;
        setPlayers(nextPlayers);

        const finishedPlayers = getFinishedGamePlayers(
          nextPlayers,
          expectedGamePlayerCountRef.current
        );

        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("CLEAR_PLAYER_DARTS", { detail: { key } })
          );
        }, TURN_RESULT_DELAY_MS);

        if (
          data.room &&
          finishedPlayers &&
          !gameFinishedEmittedRef.current
        ) {
          const gameId = `${room}:${gameIdRef.current}`;
          const ranking = buildRanking(finishedPlayers);
          gameFinishedEmittedRef.current = true;
          onPlayersFinishRef.current?.(
            finishedPlayers.map((player) => ({
              name: player.name,
              score: player.score,
            })),
            gameId
          );
          emitFinishGame(data.room, finishedPlayers);
          window.dispatchEvent(
            new CustomEvent("GAME_FINISHED", {
              detail: {
                room: data.room,
                ranking,
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

    const onGameStarted = (data: { players?: string[] }) => {
      if (Array.isArray(data.players)) {
        const uniquePlayers = Array.from(new Set(data.players)).filter(Boolean);
        expectedGamePlayerCountRef.current = uniquePlayers.length;
        queuedPlayerIdsRef.current = uniquePlayers;
        onLog?.(`Game started with expected players: ${uniquePlayers.length}`);
      }
    };

    const onResetQueue = () => {
      playerLastScoresRef.current.clear();
      playerAliasKeyRef.current.clear();
      finishedPlayerKeysRef.current.clear();
      queuedPlayerIdsRef.current = [];
      expectedGamePlayerCountRef.current = 0;
      gameFinishedEmittedRef.current = false;
      window.dispatchEvent(new CustomEvent("RESET_SCENE"));
    };

    const onResetScene = () => {
      playerLastScoresRef.current.clear();
      playerAliasKeyRef.current.clear();
      finishedPlayerKeysRef.current.clear();
      queuedPlayerIdsRef.current = [];
      expectedGamePlayerCountRef.current = 0;
      gameFinishedEmittedRef.current = false;
    };

    socket.on("connect", onConnect);
    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);
    socket.on("status-queue", onStatusQueue);
    socket.on("dart-thrown", onDartThrown);
    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("game-result", onGameResult);
    socket.on("game-finished", onGameFinished);
    socket.on("game-started", onGameStarted);
    socket.on("reset-queue", onResetQueue);
    window.addEventListener("RESET_SCENE", onResetScene);
    const queueStatusTimerId = window.setInterval(() => {
      if (socket.connected) {
        socket.emit("status-queue");
      }
    }, QUEUE_STATUS_INTERVAL_MS);

    return () => {
      window.clearInterval(queueStatusTimerId);
      socket.off("connect", onConnect);
      socket.off("clientInfo", onClientInfo);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomPlayerCount", onRoomPlayerCount);
      socket.off("status-queue", onStatusQueue);
      socket.off("dart-thrown", onDartThrown);
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("game-result", onGameResult);
      socket.off("game-finished", onGameFinished);
      socket.off("game-started", onGameStarted);
      socket.off("reset-queue", onResetQueue);
      window.removeEventListener("RESET_SCENE", onResetScene);
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
