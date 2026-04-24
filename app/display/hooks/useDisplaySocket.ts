import {
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { socket } from "@/shared/socket";
import {
  MAX_PLAYERS,
  type PlayerSlot,
} from "@/lib/room";
import {
  getPlayerSocketIds,
  getQueuePlayerKey,
} from "@/app/display/lib/playerKey";
import {
  getExistingPlayerEntry,
  rememberPlayerAliases,
  removeDuplicateWaitingPlayers,
  resolveDisplayPlayerKey,
} from "@/app/display/lib/playerState";
import { getRouletteCenter, getRouletteRadius } from "../three/Scene";
import {
  clamp,
  getHitScoreFromAim as getHitScoreFromAimBase,
  DEFAULT_ROULETTE_RADIUS,
} from "@/lib/score";
import { DART_TIME_LIMIT_MS, TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";
import type { PlayerScore } from "@/app/display/types/player";
import { stripDisplayName } from "@/lib/displayName";

type AimState = Map<string, { x: number; y: number; skin?: string }>;
const QUEUE_STATUS_INTERVAL_MS = 5000;

interface UseDisplaySocketProps {
  room: string;
  onLog?: (msg: string) => void;
  setAimPositions: Dispatch<SetStateAction<AimState>>;
  setPlayers: Dispatch<SetStateAction<Map<string, PlayerScore>>>;
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
  return getHitScoreFromAimBase(
    aim,
    getCurrentRouletteRadius(),
    getRouletteCenter()
  );
}

export function useDisplaySocket({
  room,
  onLog,
  setAimPositions,
  setPlayers,
  players,
  onPlayersFinish,
}: UseDisplaySocketProps) {
  const playersRef = useRef(players);
  const onPlayersFinishRef = useRef(onPlayersFinish);
  const gameFinishedHandledRef = useRef(false);
  const gameIdRef = useRef(0);
  const finishedPlayerKeysRef = useRef<Set<string>>(new Set());
  const playerAliasKeyRef = useRef<Map<string, string>>(new Map());
  const queuedPlayerIdsRef = useRef<string[]>([]);
  // React state 비동기 반영 경쟁 조건 방지: 마지막 점수를 ref로 동기 추적
  const playerLastScoresRef = useRef<Map<string, { name: string; score: number }>>(new Map());

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    onPlayersFinishRef.current = onPlayersFinish;
  }, [onPlayersFinish]);

  useEffect(() => {
    if (!room) return;

    const isRoomEvent = (roomName?: string) => !roomName || roomName === room;
    const getQueuedSocketSlot = (socketId?: string): PlayerSlot | undefined => {
      if (!socketId) return undefined;
      const slotIndex = queuedPlayerIdsRef.current.indexOf(socketId);
      return slotIndex >= 0 ? ((slotIndex + 1) as PlayerSlot) : undefined;
    };

    const logPlayerCount = (
      label: string,
      data: { room: string; playerCount: number }
    ) => {
      onLog?.(`${label}: ${data.room}, Players: ${data.playerCount}`);
    };
    const resetSessionRefs = () => {
      playerLastScoresRef.current.clear();
      playerAliasKeyRef.current.clear();
      finishedPlayerKeysRef.current.clear();
      gameFinishedHandledRef.current = false;
    };
    const clearDisplayState = () => {
      setAimPositions(new Map());
      setPlayers(new Map());
      playersRef.current = new Map();
    };

    if (!socket.connected) {
      socket.io.opts.query = { room };
      socket.connect();
    }

    const onConnect = () => {
      onLog?.(`Socket connected: ${socket.id}`);
      onLog?.(`Observing room: ${room}`);

      socket.emit("status-queue");
    };

    const resetAggregationForNewGame = () => {
      const hasRegisteredPlayers = Array.from(playersRef.current.values()).some(
        (player) => player.slot
      );

      if (!hasRegisteredPlayers || gameFinishedHandledRef.current) {
        gameIdRef.current += 1;
        playerLastScoresRef.current.clear();
        finishedPlayerKeysRef.current.clear();
        playerAliasKeyRef.current.clear();
        gameFinishedHandledRef.current = false;
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

    const onJoinedRoom = (data: {
      room: string;
      playerCount: number;
      players?: Array<{ socketId: string; name: string }>;
    }) => {
      if (!isRoomEvent(data.room)) return;
      logPlayerCount("Room joined", data);

      const joinedSocketIds = getPlayerSocketIds(data.players);
      if (joinedSocketIds.length > 0) {
        queuedPlayerIdsRef.current = Array.from(
          new Set([...queuedPlayerIdsRef.current, ...joinedSocketIds])
        ).slice(0, MAX_PLAYERS);
      }

      setPlayers((prev) => {
        const next = new Map(prev);
        const joinedSocketIdSet = new Set(joinedSocketIds);

        if (joinedSocketIdSet.size > 0) {
          Array.from(next.entries()).forEach(([key, player]) => {
            if (
              player.isWaiting &&
              player.socketId &&
              !joinedSocketIdSet.has(player.socketId)
            ) {
              next.delete(key);
            }
          });
        }

        data.players?.forEach((joinedPlayer) => {
          if (!joinedPlayer.socketId) return;

          const displayName = stripDisplayName(joinedPlayer.name);
          const existingEntry =
            Array.from(next.entries()).find(
              ([, player]) =>
                player.socketId === joinedPlayer.socketId ||
                player.serverName === joinedPlayer.name ||
                player.name === displayName
            ) ?? [getQueuePlayerKey(joinedPlayer.socketId), undefined];
          const [key, existing] = existingEntry;
          const slot =
            existing?.slot ?? getQueuedSocketSlot(joinedPlayer.socketId);
          rememberPlayerAliases(playerAliasKeyRef.current, key, {
            socketId: joinedPlayer.socketId,
            name: joinedPlayer.name,
          });

          next.set(key, {
            socketId: joinedPlayer.socketId,
            serverName: joinedPlayer.name,
            slot,
            name: displayName,
            score: existing?.score ?? 0,
            isConnected: true,
            isReady: existing?.isReady ?? false,
            isWaiting: false,
            totalThrows: existing?.totalThrows ?? 0,
            currentThrows: existing?.currentThrows ?? 0,
            throwScores: existing?.throwScores ?? [],
            dartDeadlineEndsAt: existing?.dartDeadlineEndsAt,
            turnDelayEndsAt: existing?.turnDelayEndsAt,
          });
        });

        playersRef.current = next;
        return next;
      });
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
        const queuedSocketIdSet = new Set(uniqueQueue);
        let changed = false;

        Array.from(next.entries()).forEach(([key, player]) => {
          if (!player.isWaiting || !player.socketId) return;

          if (!queuedSocketIdSet.has(player.socketId)) {
            next.delete(key);
            changed = true;
            return;
          }

          const slot = getQueuedSocketSlot(player.socketId);
          if (slot && player.slot !== slot) {
            next.set(key, { ...player, slot });
            changed = true;
          }
        });

        if (changed) {
          playersRef.current = next;
          return next;
        }

        return prev;
      });
    };

    const onDartThrown = (data: {
      room: string;
      name?: string;
      socketId?: string;
      slot?: PlayerSlot;
      skin?: string;
      aim: { x: number; y: number };
      score?: number;
    }) => {
      if (!isRoomEvent(data.room)) return;

      const key = resolveDisplayPlayerKey(data, {
        aliasMap: playerAliasKeyRef.current,
        getQueuedSocketSlot,
      });
      rememberPlayerAliases(playerAliasKeyRef.current, key, data);
      if (finishedPlayerKeysRef.current.has(key)) {
        onLog?.(`Ignored dart from finished player ${key}`);
        return;
      }
      if (!playersRef.current.has(key)) {
        const displayName = data.name ? stripDisplayName(data.name) : key;
        const nextPlayers = new Map(playersRef.current);
        removeDuplicateWaitingPlayers(nextPlayers, key, data.socketId);
        nextPlayers.set(key, {
          socketId: data.socketId,
          serverName: data.name,
          slot: data.slot ?? getQueuedSocketSlot(data.socketId),
          name: displayName,
          score: 0,
          isConnected: true,
          isReady: true,
          isWaiting: false,
          totalThrows: 0,
          currentThrows: 0,
          throwScores: [],
          dartDeadlineEndsAt: Date.now() + DART_TIME_LIMIT_MS,
          turnDelayEndsAt: undefined,
        });
        playersRef.current = nextPlayers;
        setPlayers(nextPlayers);
      }

      const score =
        typeof data.score === "number" ? data.score : getHitScoreFromAim(data.aim);
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
      slot?: PlayerSlot;
      skin?: string;
      registration?: boolean;
      queueRegistration?: boolean;
      aim: { x: number; y: number };
    }) => {
      if (!isRoomEvent(data.room)) return;

      const key = resolveDisplayPlayerKey(data, {
        aliasMap: playerAliasKeyRef.current,
        getQueuedSocketSlot,
      });
      rememberPlayerAliases(playerAliasKeyRef.current, key, data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);
      const displayName = data.name ? stripDisplayName(data.name) : key;
      const slot = data.slot ?? getQueuedSocketSlot(data.socketId);
      const isRegistration = data.registration === true;
      const isQueueRegistration = data.queueRegistration === true;

      if (isQueueRegistration) {
        const waitingKey = data.socketId ? getQueuePlayerKey(data.socketId) : key;
        rememberPlayerAliases(playerAliasKeyRef.current, waitingKey, data);

        setPlayers((prev) => {
          const next = new Map(prev);
          const existingEntry = getExistingPlayerEntry(next, waitingKey, data);
          const existingKey = existingEntry?.[0];
          const existing = existingEntry?.[1];

          if (existingKey && existingKey !== waitingKey) {
            next.delete(existingKey);
          }
          removeDuplicateWaitingPlayers(next, waitingKey, data.socketId);

          next.set(waitingKey, {
            socketId: data.socketId,
            serverName: data.name,
            slot: slot ?? existing?.slot,
            name: displayName,
            score: existing?.score ?? 0,
            isConnected: true,
            isReady: false,
            isWaiting: true,
            totalThrows: existing?.totalThrows ?? 0,
            currentThrows: existing?.currentThrows ?? 0,
            throwScores: existing?.throwScores ?? [],
            dartDeadlineEndsAt: undefined,
            turnDelayEndsAt: undefined,
          });

          playersRef.current = next;
          return next;
        });

        return;
      }

      const startsNewGame = isRegistration ? resetAggregationForNewGame() : false;
      if (startsNewGame) {
        window.dispatchEvent(new CustomEvent("GAME_STARTED"));
      }

      if (key) {
        if (startsNewGame) {
          setAimPositions(new Map());
        }
        let shouldUpdateAim = !isRegistration;

        setPlayers((prev) => {
          const next = startsNewGame ? new Map<string, PlayerScore>() : new Map(prev);
          const existingEntry = getExistingPlayerEntry(next, key, data);
          const existingKey = existingEntry?.[0];
          const existing = existingEntry?.[1];
          if (existingKey && existingKey !== key) {
            next.delete(existingKey);
          }
          removeDuplicateWaitingPlayers(next, key, data.socketId);

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
            playersRef.current = next;
            return next;
          }

          return next;
        });

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
      slot?: PlayerSlot;
      totalThrows?: number;
    }) => {
      if (!isRoomEvent(data.room)) return;

      const key = resolveDisplayPlayerKey(data, {
        aliasMap: playerAliasKeyRef.current,
        getQueuedSocketSlot,
      });
      rememberPlayerAliases(playerAliasKeyRef.current, key, data);
      setAimPositions((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      if (key) {
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

        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("CLEAR_PLAYER_DARTS", { detail: { key } })
          );
        }, TURN_RESULT_DELAY_MS);
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
    };

    const onGameFinished = (data: {
      room: string;
      ranking: Array<{
        name: string;
        score: number;
        rank: number;
      }>;
    }) => {
      if (!isRoomEvent(data.room)) return;
      if (gameFinishedHandledRef.current) return;
      gameFinishedHandledRef.current = true;

      onLog?.(`Game finished in room: ${data.room}`);
      onLog?.(`Final ranking:`);

      data.ranking.forEach((player) => {
        onLog?.(`  ${player.rank}위: ${player.name} - ${player.score}점`);
      });

      const gameId = `${data.room}:${gameIdRef.current}`;
      onPlayersFinishRef.current?.(
        data.ranking.map((player) => ({
          name: stripDisplayName(player.name),
          score: player.score,
        })),
        gameId
      );
      const displayRanking = data.ranking.map((player) => ({
        ...player,
        name: stripDisplayName(player.name),
      }));
      window.dispatchEvent(
        new CustomEvent("GAME_FINISHED", {
          detail: { ...data, ranking: displayRanking },
        })
      );
    };

    const onGameStarted = (data: { players?: string[] }) => {
      resetSessionRefs();
      clearDisplayState();
      if (Array.isArray(data.players)) {
        const uniquePlayers = Array.from(new Set(data.players)).filter(Boolean);
        queuedPlayerIdsRef.current = uniquePlayers;
        onLog?.(`Game started with expected players: ${uniquePlayers.length}`);
      }
      window.dispatchEvent(new CustomEvent("GAME_STARTED"));
    };

    const onResetQueue = () => {
      resetSessionRefs();
      queuedPlayerIdsRef.current = [];
      clearDisplayState();
      window.dispatchEvent(new CustomEvent("RESET_SCENE"));
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
    };
  }, [
    room,
    onLog,
    setAimPositions,
    setPlayers,
  ]);

  return {};
}
