import { useCallback } from "react";
import { useQueue } from "@/app/mobile/hooks/useQueue";
import { debugLog } from "@/app/mobile/components/DebugOverlay";
import type { PlayerSlot } from "@/lib/room";

type UseQueueSessionFlowParams = {
  room: string;
  name: string;
  isInGame: boolean;
  startSensors: () => void;
  setAssignedSlot: (value: PlayerSlot | null) => void;
  setHasJoined: (value: boolean) => void;
  setIsInGame: (value: boolean) => void;
};

type UseQueueSessionFlowReturn = {
  isInQueue: boolean;
  queuePosition: number | null;
  queueSnapshot: string[] | null;
  approvalRemainingSeconds: number | null;
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
}: UseQueueSessionFlowParams): UseQueueSessionFlowReturn {
  const handleEnterGame = useCallback(
    (slot: PlayerSlot) => {
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
    approvalRemainingSeconds,
    joinedQueueRef,
    leaveQueue,
    connectAndJoinQueue,
  } = useQueue({
    room,
    name,
    isInGame,
    onEnterGame: handleEnterGame,
  });

  return {
    isInQueue,
    queuePosition,
    queueSnapshot,
    approvalRemainingSeconds,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
  };
}
