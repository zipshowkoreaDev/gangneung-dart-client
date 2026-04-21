import { useEffect, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import { getAllPlayerRooms, getPlayerRoom, type PlayerSlot } from "@/lib/room";
import { debugLog } from "@/app/mobile/components/DebugOverlay";

interface UseMobileSocketProps {
  room: string;
  name: string;
  enabled: boolean;
  slot: PlayerSlot | null;
  onPlayerFinished?: (playerId: string) => void;
}

export function useMobileSocket({
  room,
  name,
  enabled,
  slot,
  onPlayerFinished,
}: UseMobileSocketProps) {
  const throwCountRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const slotRef = useRef<PlayerSlot | null>(null);

  const onPlayerFinishedRef = useRef(onPlayerFinished);
  useEffect(() => {
    onPlayerFinishedRef.current = onPlayerFinished;
  }, [onPlayerFinished]);

  // enabled가 true로 바뀔 때(재입장 포함)에도 slotRef를 동기화
  useEffect(() => {
    slotRef.current = slot;
  }, [slot, enabled]);

  // enabled && slot이 있을 때 joinRoom
  useEffect(() => {
    if (!room || !enabled || !slot) return;

    const playerRoom = getPlayerRoom(room, slot);
    const playerRooms = getAllPlayerRooms(room);

    if (hasJoinedRef.current && currentRoomRef.current === playerRoom) {
      return;
    }

    if (!socket.connected) {
      socket.io.opts.query = { room, name };
      socket.connect();
    }

    const joinPlayerRoom = () => {
      if (hasJoinedRef.current && currentRoomRef.current === playerRoom) return;
      debugLog(`[Socket] joinRoom: ${playerRoom}, name: ${name}`);
      playerRooms.forEach((targetRoom) => {
        socket.emit("joinRoom", { room: targetRoom, name });
        joinedRoomsRef.current.add(targetRoom);
      });
      socket.emit("aim-update", {
        room: playerRoom,
        socketId: socket.id,
        name,
        aim: { x: 0, y: 0 },
        registration: true,
      });
      hasJoinedRef.current = true;
      currentRoomRef.current = playerRoom;
    };

    const handleConnect = () => {
      debugLog("[Socket] connected");
      joinPlayerRoom();
    };

    const handleAimOff = (data: {
      socketId?: string;
      playerId?: string;
      name?: string;
    }) => {
      const playerId = data.socketId || data.playerId || data.name;
      if (!playerId || playerId === "_display") return;
      debugLog(`[Socket] player finished: ${playerId}`);
      onPlayerFinishedRef.current?.(playerId);
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

    if (socket.connected && !hasJoinedRef.current) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("aim-off", handleAimOff);
    };
  }, [room, name, enabled, slot]);

  const leaveJoinedRooms = useCallback((reason: string) => {
    if (!socket.connected) return;
    const joinedRooms = Array.from(joinedRoomsRef.current);
    joinedRooms.forEach((joinedRoom) => {
      debugLog(`[Socket] leaveRoom (${reason}): ${joinedRoom}`);
      socket.emit("leaveRoom", { room: joinedRoom });
    });
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
      const playerRoom = getPlayerRoom(room, slotRef.current);
      socket.emit("aim-update", {
        room: playerRoom,
        socketId: socket.id,
        name,
        skin,
        aim,
      });
    },
    [room, name]
  );

  const emitThrowDart = useCallback(
    (payload: { aim: { x: number; y: number }; score: number; zone?: string }) => {
      if (!socket.connected || !slotRef.current) return;
      const playerRoom = getPlayerRoom(room, slotRef.current);
      socket.emit("throw-dart", {
        room: playerRoom,
        socketId: socket.id,
        name,
        aim: payload.aim,
        score: payload.score,
        zone: payload.zone,
      });

      throwCountRef.current += 1;

      if (throwCountRef.current >= 3) {
        socket.emit("aim-off", { room: playerRoom, socketId: socket.id, name });
        throwCountRef.current = 3;
      }
    },
    [room, name]
  );

  const emitAimOff = useCallback(() => {
    if (!socket.connected || !slotRef.current) return;
    const playerRoom = getPlayerRoom(room, slotRef.current);
    socket.emit("aim-off", { room: playerRoom, socketId: socket.id, name });
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
    joinedRoomsRef.current.clear();
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
