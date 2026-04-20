import { useCallback, useEffect } from "react";
import { useQueue } from "@/app/mobile/hooks/useQueue";
import { debugLog } from "@/app/mobile/components/DebugOverlay";

type UseQueueSessionFlowParams = {
  room: string;
  name: string;
  isInGame: boolean;
  startSensors: () => void;
  setAssignedSlot: (value: 1 | 2 | null) => void;
  setHasJoined: (value: boolean) => void;
  setIsInGame: (value: boolean) => void;
  setIsInQueue: (value: boolean) => void;
};

type UseQueueSessionFlowReturn = {
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
  startSensors,
  setAssignedSlot,
  setHasJoined,
  setIsInGame,
  setIsInQueue,
}: UseQueueSessionFlowParams): UseQueueSessionFlowReturn {
  const handleEnterGame = useCallback(
    (slot: 1 | 2) => {
      debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
      setAssignedSlot(slot);
      setHasJoined(true);
      setIsInGame(true);
      startSensors();
    },
    [setAssignedSlot, setHasJoined, setIsInGame, startSensors]
  );

  const {
    isInQueue,
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    leaveQueue,
    connectAndJoinQueue,
  } = useQueue({
    room,
    name,
    isInGame,
    onEnterGame: handleEnterGame,
  });

  useEffect(() => {
    setIsInQueue(isInQueue);
  }, [isInQueue, setIsInQueue]);

  return {
    isInQueue,
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
  };
}
