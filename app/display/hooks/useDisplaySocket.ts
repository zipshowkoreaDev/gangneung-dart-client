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
  getSlotPlayerKey,
} from "@/app/display/lib/playerKey";
import {
  getExistingPlayerEntry,
  rememberPlayerAliases,
  removeDuplicateWaitingPlayers,
  resolveDisplayPlayerKey,
} from "@/app/display/lib/playerState";
import { clamp } from "@/lib/dartboardMath";
import { DART_TIME_LIMIT_MS, TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";
import type { PlayerScore } from "@/app/display/types/player";
import { stripDisplayName } from "@/lib/displayName";
import { DISPLAY_EVENTS } from "@/lib/displayEvents";
import type { TurnSyncState } from "@/app/shared/types/turnSync";
import { getHitScoreFromAim } from "@/app/display/lib/displayScoring";
import {
  clearDisconnectedPlayers,
  collectRemovedPlayerKeys,
  createThrowFingerprint,
  isRecentDuplicateThrow,
  rememberThrowFingerprint,
} from "@/app/display/lib/displaySocketSync";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

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
  const waitingPlayerIdsRef = useRef<string[]>([]);
  const recentThrowFingerprintsRef = useRef<Map<string, number>>(new Map());
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
    const getWaitingSocketSlot = (socketId?: string): PlayerSlot | undefined => {
      if (!socketId) return undefined;
      const slotIndex = waitingPlayerIdsRef.current.indexOf(socketId);
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
      recentThrowFingerprintsRef.current.clear();
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
    };

    const onDisconnect = (reason: string) => {
      onLog?.(`Socket disconnected: ${reason}`);

      if (reason === "io server disconnect") {
        waitingPlayerIdsRef.current = [];
        resetSessionRefs();
        clearDisplayState();
        socket.connect();
      }
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
      const removedPlayerKeys: string[] = [];
      if (joinedSocketIds.length > 0) {
        waitingPlayerIdsRef.current = Array.from(new Set(joinedSocketIds)).slice(
          0,
          MAX_PLAYERS,
        );
      }

      setPlayers((prev) => {
        const next = new Map(prev);
        if (Array.isArray(data.players)) {
          removedPlayerKeys.push(...collectRemovedPlayerKeys(next, joinedSocketIds));
        }

        data.players?.forEach((joinedPlayer) => {
          if (!joinedPlayer.socketId) return;

          const displayName = stripDisplayName(joinedPlayer.name);
          const slot = getWaitingSocketSlot(joinedPlayer.socketId);
          const slotKey = getSlotPlayerKey(slot);
          const existingEntry =
            (slotKey && next.has(slotKey)
              ? ([slotKey, next.get(slotKey)!] as [string, PlayerScore])
              : undefined) ??
            Array.from(next.entries()).find(
              ([, player]) =>
                player.socketId === joinedPlayer.socketId ||
                player.serverName === joinedPlayer.name
            );
          const key = slotKey ?? existingEntry?.[0] ?? joinedPlayer.socketId;
          const existing = existingEntry?.[1];
          if (existingEntry && existingEntry[0] !== key) {
            next.delete(existingEntry[0]);
          }
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
            isWaiting:
              existing?.isReady || (existing?.totalThrows ?? 0) > 0
                ? false
                : true,
            totalThrows: existing?.totalThrows ?? 0,
            currentThrows: existing?.currentThrows ?? 0,
            throwScores: existing?.throwScores ?? [],
            dartDeadlineEndsAt:
              existing?.isReady && !existing?.isWaiting
                ? existing.dartDeadlineEndsAt
                : undefined,
            turnDelayEndsAt:
              existing?.isReady && !existing?.isWaiting
                ? existing.turnDelayEndsAt
                : undefined,
          });
        });

        playersRef.current = next;
        return next;
      });

      clearDisconnectedPlayers({
        finishedPlayerKeys: finishedPlayerKeysRef.current,
        playerAliases: playerAliasKeyRef.current,
        playerLastScores: playerLastScoresRef.current,
        removedPlayerKeys,
        setAimPositions,
        onLog,
      });
    };

    const onRoomPlayerCount = (data: { room: string; playerCount: number }) => {
      logPlayerCount("Player count", data);
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
        getWaitingSocketSlot,
      });
      rememberPlayerAliases(playerAliasKeyRef.current, key, data);
      if (finishedPlayerKeysRef.current.has(key)) {
        onLog?.(`Ignored dart from finished player ${key}`);
        return;
      }

      const fingerprint = createThrowFingerprint({
        key,
        socketId: data.socketId,
        score: data.score,
        aim: data.aim,
      });
      const now = Date.now();
      if (isRecentDuplicateThrow(recentThrowFingerprintsRef.current, fingerprint, now)) {
        onLog?.(`Ignored duplicate dart-thrown event: ${key}`);
        return;
      }
      rememberThrowFingerprint(recentThrowFingerprintsRef.current, fingerprint, now);

      if (!playersRef.current.has(key)) {
        const displayName = data.name ? stripDisplayName(data.name) : key;
        const nextPlayers = new Map(playersRef.current);
        removeDuplicateWaitingPlayers(nextPlayers, key, data.socketId);
        nextPlayers.set(key, {
          socketId: data.socketId,
          serverName: data.name,
          slot: data.slot ?? getWaitingSocketSlot(data.socketId),
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
        new CustomEvent(DISPLAY_EVENTS.dartThrow, {
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
      aim: { x: number; y: number };
      turnSyncState?: TurnSyncState;
    }) => {
      if (!isRoomEvent(data.room)) return;

      const key = resolveDisplayPlayerKey(data, {
        aliasMap: playerAliasKeyRef.current,
        getWaitingSocketSlot,
      });
      rememberPlayerAliases(playerAliasKeyRef.current, key, data);
      const x = clamp(data.aim?.x ?? 0, -1, 1);
      const y = clamp(data.aim?.y ?? 0, -1, 1);
      const displayName = data.name ? stripDisplayName(data.name) : key;
      const slot = data.slot ?? getWaitingSocketSlot(data.socketId);
      const isRegistration = data.registration === true;
      const startsNewGame = isRegistration ? resetAggregationForNewGame() : false;
      if (startsNewGame) {
        window.dispatchEvent(new CustomEvent(DISPLAY_EVENTS.gameStarted));
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
              score: data.turnSyncState?.score ?? existing.score,
              totalThrows:
                data.turnSyncState?.totalThrows ?? existing.totalThrows,
              currentThrows:
                data.turnSyncState?.currentThrows ?? existing.currentThrows,
              throwScores:
                data.turnSyncState?.throwScores ?? existing.throwScores,
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
              score: data.turnSyncState?.score ?? 0,
              isConnected: true,
              isReady: !isRegistration,
              isWaiting: false,
              totalThrows: data.turnSyncState?.totalThrows ?? 0,
              currentThrows: data.turnSyncState?.currentThrows ?? 0,
              throwScores: data.turnSyncState?.throwScores ?? [],
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

        if (Array.isArray(data.turnSyncState?.thrownAims)) {
          window.dispatchEvent(
            new CustomEvent(DISPLAY_EVENTS.syncPlayerDarts, {
              detail: { key, aims: data.turnSyncState.thrownAims },
            })
          );
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
        getWaitingSocketSlot,
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
            new CustomEvent(DISPLAY_EVENTS.clearPlayerDarts, { detail: { key } })
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
        new CustomEvent(DISPLAY_EVENTS.gameFinished, {
          detail: { ...data, ranking: displayRanking },
        })
      );
    };

    const onGameStarted = (data: { players?: string[] }) => {
      resetSessionRefs();
      clearDisplayState();
      if (Array.isArray(data.players)) {
        const uniquePlayers = Array.from(new Set(data.players)).filter(Boolean);
        waitingPlayerIdsRef.current = uniquePlayers;
        onLog?.(`Game started with expected players: ${uniquePlayers.length}`);
      }
      window.dispatchEvent(new CustomEvent(DISPLAY_EVENTS.gameStarted));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("clientInfo", onClientInfo);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("roomPlayerCount", onRoomPlayerCount);
    socket.on("dart-thrown", onDartThrown);
    socket.on("aim-update", onAimUpdate);
    socket.on("aim-off", onAimOff);
    socket.on("game-result", onGameResult);
    socket.on("game-finished", onGameFinished);
    socket.on("game-started", onGameStarted);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("clientInfo", onClientInfo);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("roomPlayerCount", onRoomPlayerCount);
      socket.off("dart-thrown", onDartThrown);
      socket.off("aim-update", onAimUpdate);
      socket.off("aim-off", onAimOff);
      socket.off("game-result", onGameResult);
      socket.off("game-finished", onGameFinished);
      socket.off("game-started", onGameStarted);
    };
  }, [
    room,
    onLog,
    setAimPositions,
    setPlayers,
  ]);

  return {};
}
