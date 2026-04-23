import { useEffect, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import type { PlayerSlot } from "@/lib/room";
import { debugLog } from "@/app/mobile/debugLog";

interface UseMobileSocketProps {
  room: string;
  name: string;
  enabled: boolean;
  slot: PlayerSlot | null;
  onPlayerFinished?: (playerId: string) => void;
  onPlayerScored?: (player: {
    socketId: string;
    name: string;
    score: number;
  }) => void;
}

export function useMobileSocket({
  room,
  name,
  enabled,
  slot,
  onPlayerFinished,
  onPlayerScored,
}: UseMobileSocketProps) {
  const throwCountRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");
  const slotRef = useRef<PlayerSlot | null>(null);

  const onPlayerFinishedRef = useRef(onPlayerFinished);
  useEffect(() => {
    onPlayerFinishedRef.current = onPlayerFinished;
  }, [onPlayerFinished]);
  const onPlayerScoredRef = useRef(onPlayerScored);
  useEffect(() => {
    onPlayerScoredRef.current = onPlayerScored;
  }, [onPlayerScored]);

  // enabled가 true로 바뀔 때(재입장 포함)에도 slotRef를 동기화
  useEffect(() => {
    slotRef.current = slot;
    if (enabled && slot) {
      throwCountRef.current = 0;
    }
  }, [slot, enabled]);

  // enabled && slot이 있을 때 joinRoom
  useEffect(() => {
    if (!room || !enabled || !slot) return;

    if (hasJoinedRef.current && currentRoomRef.current === room) {
      return;
    }

    if (!socket.connected) {
      socket.io.opts.query = { room, name };
      socket.connect();
    }

    const joinPlayerRoom = () => {
      if (hasJoinedRef.current && currentRoomRef.current === room) return;
      debugLog(`[Socket] joinRoom: ${room}, name: ${name}`);
      socket.emit("joinRoom", { room, name });
      socket.emit("aim-update", {
        room,
        socketId: socket.id,
        name,
        slot,
        aim: { x: 0, y: 0 },
        registration: true,
      });
      hasJoinedRef.current = true;
      currentRoomRef.current = room;
    };

    const handleConnect = () => {
      debugLog("[Socket] connected");
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

    const handleDisconnect = () => {
      debugLog("[Socket] disconnected");
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      throwCountRef.current = 0;
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("aim-off", handleAimOff);
    socket.on("dart-thrown", handleDartThrown);

    if (socket.connected && !hasJoinedRef.current) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("aim-off", handleAimOff);
      socket.off("dart-thrown", handleDartThrown);
    };
  }, [room, name, enabled, slot]);

  const leaveJoinedRooms = useCallback((reason: string) => {
    if (!socket.connected) return;
    if (!currentRoomRef.current) return;
    debugLog(`[Socket] leaveRoom (${reason}): ${currentRoomRef.current}`);
    socket.emit("leaveRoom", { room: currentRoomRef.current });
  }, []);

  // unmount 시 정리
  useEffect(() => {
    return () => {
      leaveJoinedRooms("unmount");
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
    };
  }, [leaveJoinedRooms]);

  const emitAimUpdate = useCallback(
    (aim: { x: number; y: number }, skin?: string) => {
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
  }, [leaveJoinedRooms, name]);

  return {
    emitAimUpdate,
    emitThrowDart,
    emitAimOff,
    leaveGame,
    socketId: socket.id,
  };
}
