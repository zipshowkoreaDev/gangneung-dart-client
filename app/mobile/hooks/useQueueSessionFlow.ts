import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "@/shared/socket";
import { useQueue } from "@/app/mobile/hooks/useQueue";
import { useAimTimeout } from "@/app/mobile/hooks/useAimTimeout";
import { debugLog } from "@/app/mobile/components/DebugOverlay";

type UseQueueSessionFlowParams = {
  room: string;
  name: string;
  isInGame: boolean;
  hasFinishedTurn: boolean;
  startSensors: () => void;
  stopSensors: () => void;
  leaveGame: () => void;
  setHasFinishedTurn: (value: boolean) => void;
  setAssignedSlot: (value: 1 | 2 | null) => void;
  setHasJoined: (value: boolean) => void;
  setIsInGame: (value: boolean) => void;
  setIsInQueue: (value: boolean) => void;
};

type UseQueueSessionFlowReturn = {
  assignedSlot: 1 | 2 | null;
  isInQueue: boolean;
  queuePosition: number | null;
  queueSnapshot: string[] | null;
  joinedQueueRef: React.MutableRefObject<boolean>;
  connectAndJoinQueue: () => void;
  leaveQueue: () => void;
};

export default function useQueueSessionFlow({
  room,
  name,
  isInGame,
  hasFinishedTurn,
  startSensors,
  stopSensors,
  leaveGame,
  setHasFinishedTurn,
  setAssignedSlot,
  setHasJoined,
  setIsInGame,
  setIsInQueue,
}: UseQueueSessionFlowParams): UseQueueSessionFlowReturn {
  const [assignedSlot, setAssignedSlotState] = useState<1 | 2 | null>(null);
  const startAimTimeoutRef = useRef<() => void>(() => {});

  const handleEnterGame = useCallback(
    (slot: 1 | 2) => {
      debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
      setAssignedSlotState(slot);
      setAssignedSlot(slot);
      setHasJoined(true);
      setIsInGame(true);
      startSensors();
      startAimTimeoutRef.current();
    },
    [setAssignedSlot, setHasJoined, setIsInGame, startSensors]
  );

  const {
    isInQueue,
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    setIsInQueue: setIsInQueueInner,
    leaveQueue,
    connectAndJoinQueue,
  } = useQueue({
    room,
    name,
    isInGame,
    onEnterGame: handleEnterGame,
  });

  const handleAimTimeout = useCallback(() => {
    if (joinedQueueRef.current) {
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    }
    setIsInQueueInner(false);
    setIsInQueue(false);
    setAssignedSlotState(null);
    setAssignedSlot(null);
    setHasJoined(false);
    setIsInGame(false);
    setHasFinishedTurn(false);
    leaveGame();
    stopSensors();
  }, [
    joinedQueueRef,
    setIsInQueueInner,
    setIsInQueue,
    setAssignedSlot,
    setHasJoined,
    setIsInGame,
    setHasFinishedTurn,
    leaveGame,
    stopSensors,
  ]);

  const { startAimTimeout } = useAimTimeout({
    isInGame,
    hasFinishedTurn,
    onTimeout: handleAimTimeout,
  });

  useEffect(() => {
    startAimTimeoutRef.current = startAimTimeout;
  }, [startAimTimeout]);

  useEffect(() => {
    setIsInQueue(isInQueue);
  }, [isInQueue, setIsInQueue]);

  return {
    assignedSlot,
    isInQueue,
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
  };
}
