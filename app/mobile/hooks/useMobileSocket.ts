import { useEffect, useCallback, useRef, useState } from "react";
import { socket } from "@/shared/socket";
import type { PlayerSlot } from "@/lib/room";
import { debugLog } from "@/app/mobile/lib/debugLog";

interface UseMobileSocketProps {
  room: string;
  name: string;
  enabled: boolean;
  slot: PlayerSlot | null;
  roomJoinedBeforeGame?: boolean;
  onPlayerFinished?: (playerId: string) => void;
  onPlayerScored?: (player: {
    socketId: string;
    name: string;
    score: number;
  }) => void;
  onGameResult?: (result: {
    result: "win" | "lose" | "tie";
    score: number;
    rank: number;
    totalPlayers: number;
  }) => void;
  onRoomFull?: (data: { room?: string; maxPlayers?: number }) => void;
  onRoomPlayersUpdated?: (data: {
    room?: string;
    playerCount: number;
    players?: Array<{ socketId: string; name: string }>;
  }) => void;
  onGameFinished?: () => void;
}

export function useMobileSocket({
  room,
  name,
  enabled,
  slot,
  roomJoinedBeforeGame = false,
  onPlayerFinished,
  onPlayerScored,
  onGameResult,
  onRoomFull,
  onRoomPlayersUpdated,
  onGameFinished,
}: UseMobileSocketProps) {
  const throwCountRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");
  const slotRef = useRef<PlayerSlot | null>(null);
  const gameEndedRef = useRef(false);
  const [currentSocketId, setCurrentSocketId] = useState<string | undefined>(
    () => socket.id,
  );
  const syncCurrentSocketId = useCallback(() => {
    setCurrentSocketId(socket.id);
  }, []);

  const onPlayerFinishedRef = useRef(onPlayerFinished);
  useEffect(() => {
    onPlayerFinishedRef.current = onPlayerFinished;
  }, [onPlayerFinished]);
  const onPlayerScoredRef = useRef(onPlayerScored);
  useEffect(() => {
    onPlayerScoredRef.current = onPlayerScored;
  }, [onPlayerScored]);
  const onGameResultRef = useRef(onGameResult);
  useEffect(() => {
    onGameResultRef.current = onGameResult;
  }, [onGameResult]);
  const onRoomFullRef = useRef(onRoomFull);
  useEffect(() => {
    onRoomFullRef.current = onRoomFull;
  }, [onRoomFull]);
  const onRoomPlayersUpdatedRef = useRef(onRoomPlayersUpdated);
  useEffect(() => {
    onRoomPlayersUpdatedRef.current = onRoomPlayersUpdated;
  }, [onRoomPlayersUpdated]);
  const onGameFinishedRef = useRef(onGameFinished);
  useEffect(() => {
    onGameFinishedRef.current = onGameFinished;
  }, [onGameFinished]);

  // enabled가 true로 바뀔 때(재입장 포함)에도 slotRef를 동기화
  useEffect(() => {
    slotRef.current = slot;
    if (enabled && slot) {
      throwCountRef.current = 0;
    }
  }, [slot, enabled]);

  // enabled && slot이 있을 때 게임 등록
  useEffect(() => {
    if (!room || !enabled || !slot) return;

    gameEndedRef.current = false;

    if (hasJoinedRef.current && currentRoomRef.current === room) {
      return;
    }

    if (!socket.connected) {
      socket.io.opts.query = { room, name };
      socket.connect();
    }

    const registrationTimerIds: number[] = [];
    const emitRegistration = () => {
      if (gameEndedRef.current) return;
      socket.emit("aim-update", {
        room,
        socketId: socket.id,
        name,
        slot,
        aim: { x: 0, y: 0 },
        registration: true,
      });
    };
    const joinPlayerRoom = () => {
      if (gameEndedRef.current) return;
      if (hasJoinedRef.current && currentRoomRef.current === room) return;
      syncCurrentSocketId();
      if (!roomJoinedBeforeGame) {
        debugLog(`[Socket] joinRoom: ${room}, name: ${name}`);
        socket.emit("joinRoom", { room, name });
      }
      emitRegistration();
      registrationTimerIds.push(
        window.setTimeout(emitRegistration, 300),
        window.setTimeout(emitRegistration, 1000)
      );
      hasJoinedRef.current = true;
      currentRoomRef.current = room;
    };

    const handleConnect = () => {
      debugLog("[Socket] connected");
      syncCurrentSocketId();
      joinPlayerRoom();
    };

    const handleAimOff = (data: {
      socketId?: string;
      playerId?: string;
      name?: string;
      totalThrows?: number;
    }) => {
      if ((data.totalThrows ?? 0) < 3) {
        return;
      }

      const playerId = data.socketId || data.playerId || data.name;
      if (!playerId) return;
      debugLog(`[Socket] player finished: ${playerId}`);
      onPlayerFinishedRef.current?.(playerId);
    };
    const handleDartThrown = (data: {
      socketId?: string;
      playerId?: string;
      name?: string;
      score?: number;
    }) => {
      const playerId = data.socketId || data.playerId || data.name;
      if (!playerId || typeof data.score !== "number") return;
      onPlayerScoredRef.current?.({
        socketId: playerId,
        name: data.name ?? playerId,
        score: data.score,
      });
    };
    const handleGameResult = (data: {
      results?: Record<
        string,
        {
          result: "win" | "lose" | "tie";
          score: number;
          rank: number;
          totalPlayers: number;
        }
      >;
    }) => {
      const mySocketId = socket.id;
      const myResult = mySocketId ? data.results?.[mySocketId] : undefined;
      if (!myResult) return;
      onGameResultRef.current?.(myResult);
    };
    const handleGameFinished = (data: { room?: string }) => {
      if (data.room && data.room !== room) return;
      gameEndedRef.current = true;
      socket.emit("leave-queue");
      if (currentRoomRef.current) {
        socket.emit("leaveRoom", { room: currentRoomRef.current });
      }
      onGameFinishedRef.current?.();
    };
    const handleRoomFull = (data: { room?: string; maxPlayers?: number }) => {
      debugLog(`[Socket] roomFull: ${data.room ?? room}`);
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      throwCountRef.current = 0;
      onRoomFullRef.current?.(data);
    };
    const handleJoinedRoom = (data: {
      room?: string;
      playerCount: number;
      players?: Array<{ socketId: string; name: string }>;
    }) => {
      debugLog(
        `[Socket] joinedRoom: ${data.room ?? room}, Players: ${data.playerCount}`
      );
      onRoomPlayersUpdatedRef.current?.(data);
      if (
        hasJoinedRef.current &&
        (!data.room || data.room === room) &&
        data.players?.some((player) => player.socketId === socket.id)
      ) {
        emitRegistration();
      }
    };
    const handleRoomPlayerCount = (data: {
      room?: string;
      playerCount: number;
    }) => {
      debugLog(
        `[Socket] roomPlayerCount: ${data.room ?? room}, Players: ${data.playerCount}`
      );
      onRoomPlayersUpdatedRef.current?.(data);
    };

    const handleDisconnect = () => {
      debugLog("[Socket] disconnected");
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      throwCountRef.current = 0;
      setCurrentSocketId(undefined);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("aim-off", handleAimOff);
    socket.on("dart-thrown", handleDartThrown);
    socket.on("game-result", handleGameResult);
    socket.on("game-finished", handleGameFinished);
    socket.on("roomFull", handleRoomFull);
    socket.on("joinedRoom", handleJoinedRoom);
    socket.on("roomPlayerCount", handleRoomPlayerCount);

    if (socket.connected && !hasJoinedRef.current) {
      handleConnect();
    } else if (socket.connected) {
      registrationTimerIds.push(
        window.setTimeout(syncCurrentSocketId, 0)
      );
    }

    return () => {
      registrationTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("aim-off", handleAimOff);
      socket.off("dart-thrown", handleDartThrown);
      socket.off("game-result", handleGameResult);
      socket.off("game-finished", handleGameFinished);
      socket.off("roomFull", handleRoomFull);
      socket.off("joinedRoom", handleJoinedRoom);
      socket.off("roomPlayerCount", handleRoomPlayerCount);
    };
  }, [room, name, enabled, slot, roomJoinedBeforeGame, syncCurrentSocketId]);

  const leaveJoinedRooms = useCallback((reason: string) => {
    if (!socket.connected) return;
    if (!currentRoomRef.current) return;
    debugLog(`[Socket] leaveRoom (${reason}): ${currentRoomRef.current}`);
    socket.emit("leaveRoom", { room: currentRoomRef.current });
  }, []);

  const cleanupGameSocket = useCallback((reason: string) => {
    if (!socket.connected) return;

    debugLog(`[Socket] cleanup game socket (${reason})`);
    gameEndedRef.current = true;
    socket.emit("leave-queue");
    if (currentRoomRef.current) {
      socket.emit("leaveRoom", { room: currentRoomRef.current });
    }
  }, []);

  // unmount 시 정리
  useEffect(() => {
    return () => {
      leaveJoinedRooms("unmount");
      socket.emit("leave-queue");
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
    };
  }, [leaveJoinedRooms]);

  const emitAimUpdate = useCallback(
    (aim: { x: number; y: number }, skin?: string) => {
      if (gameEndedRef.current) return;
      if (!socket.connected || !slotRef.current) return;
      socket.emit("aim-update", {
        room,
        socketId: socket.id,
        name,
        slot: slotRef.current,
        skin,
        aim,
      });
    },
    [room, name]
  );

  const emitThrowDart = useCallback(
    (payload: {
      aim: { x: number; y: number };
      zone?: string;
      score: number;
      }) => {
      if (gameEndedRef.current) return;
      if (!socket.connected || !slotRef.current) return;
      if (throwCountRef.current >= 3) return;
      socket.emit("throw-dart", {
        room,
        socketId: socket.id,
        name,
        slot: slotRef.current,
        aim: payload.aim,
        score: payload.score,
        zone: payload.zone,
      });

      throwCountRef.current += 1;
    },
    [room, name]
  );

  const emitAimOff = useCallback(() => {
    if (gameEndedRef.current) return;
    if (!socket.connected || !slotRef.current) return;
    socket.emit("aim-off", {
      room,
      socketId: socket.id,
      name,
      slot: slotRef.current,
      ...(throwCountRef.current >= 3
        ? {
            totalThrows: throwCountRef.current,
          }
        : {}),
    });
  }, [room, name]);

  const leaveGame = useCallback(() => {
    if (socket.connected) {
      socket.emit("leave-queue");
      leaveJoinedRooms("game exit");
      if (currentRoomRef.current) {
        socket.emit("aim-off", {
          room: currentRoomRef.current,
          socketId: socket.id,
          name,
        });
      }
    }

    throwCountRef.current = 0;
    hasJoinedRef.current = false;
    currentRoomRef.current = "";
    slotRef.current = null;
    gameEndedRef.current = true;
  }, [leaveJoinedRooms, name]);

  return {
    emitAimUpdate,
    emitThrowDart,
    emitAimOff,
    cleanupGameSocket,
    leaveGame,
    socketId: currentSocketId,
  };
}
