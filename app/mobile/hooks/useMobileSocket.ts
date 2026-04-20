import { useEffect, useCallback, useRef, useState } from "react";
import { socket } from "@/shared/socket";
import { getPlayerRoom } from "@/lib/room";
import { debugLog } from "@/app/mobile/components/DebugOverlay";

interface UseMobileSocketProps {
  room: string;
  name: string;
  enabled: boolean;
  slot: 1 | 2 | null;
  onGameResult?: (data: GameResultPayload) => void;
}

type GameResultPayload = {
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
};

export function useMobileSocket({
  room,
  name,
  enabled,
  slot,
  onGameResult,
}: UseMobileSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const throwCountRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const currentRoomRef = useRef<string>("");
  const slotRef = useRef<1 | 2 | null>(null);

  const onGameResultRef = useRef(onGameResult);
  useEffect(() => {
    onGameResultRef.current = onGameResult;
  }, [onGameResult]);

  // slot이 할당되면 저장
  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);

  // enabled && slot이 있을 때 joinRoom
  useEffect(() => {
    if (!room || !enabled || !slot) return;

    const playerRoom = getPlayerRoom(room, slot);

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
      socket.emit("joinRoom", { room: playerRoom, name });
      hasJoinedRef.current = true;
      currentRoomRef.current = playerRoom;
    };

    const handleConnect = () => {
      debugLog("[Socket] connected");
      setIsConnected(true);
      joinPlayerRoom();
    };

    const handleGameResult = (data: GameResultPayload) => {
      debugLog("[Socket] game-result received");
      onGameResultRef.current?.(data);
    };

    const handleDisconnect = () => {
      debugLog("[Socket] disconnected");
      setIsConnected(false);
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
      throwCountRef.current = 0;
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("game-result", handleGameResult);

    if (socket.connected && !hasJoinedRef.current) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("game-result", handleGameResult);
    };
  }, [room, name, enabled, slot]);

  // unmount 시 정리
  useEffect(() => {
    return () => {
      if (socket.connected && currentRoomRef.current) {
        debugLog(`[Socket] leaveRoom (unmount): ${currentRoomRef.current}`);
        socket.emit("leaveRoom", { room: currentRoomRef.current });
      }
      hasJoinedRef.current = false;
      currentRoomRef.current = "";
    };
  }, []);

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
        socket.emit("aim-off", { room: playerRoom, name });
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
    if (socket.connected && currentRoomRef.current) {
      debugLog(`[Socket] leaveRoom: ${currentRoomRef.current}`);
      socket.emit("leaveRoom", { room: currentRoomRef.current });
      socket.emit("aim-off", {
        room: currentRoomRef.current,
        socketId: socket.id,
        name,
      });
    }

    throwCountRef.current = 0;
    hasJoinedRef.current = false;
    currentRoomRef.current = "";
    slotRef.current = null;
  }, [name]);

  return {
    emitAimUpdate,
    emitThrowDart,
    emitAimOff,
    leaveGame,
    socketId: socket.id,
    isConnected,
  };
}
