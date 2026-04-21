import { useCallback } from "react";
import { useQueue } from "@/app/mobile/hooks/useQueue";
import { debugLog } from "@/app/mobile/components/DebugOverlay";
import type { PlayerSlot } from "@/lib/room";

type UseQueueSessionFlowParams = {
  room: string;
  name: string;
  isInGame: boolean;
  setAssignedSlot: (value: PlayerSlot | null) => void;
  setHasJoined: (value: boolean) => void;
  setIsInGame: (value: boolean) => void;
  setGamePlayers: (value: string[]) => void;
};

type UseQueueSessionFlowReturn = {
  isInQueue: boolean;
  queuePosition: number | null;
  queueSnapshot: string[] | null;
  isWaitingForApproval: boolean;
  joinedQueueRef: React.MutableRefObject<boolean>;
  connectAndJoinQueue: () => void;
  leaveQueue: () => void;
};

export default function useQueueSessionFlow({
  room,
  name,
  isInGame,
  setAssignedSlot,
  setHasJoined,
  setIsInGame,
  setGamePlayers,
}: UseQueueSessionFlowParams): UseQueueSessionFlowReturn {
  const handleEnterGame = useCallback(
    (slot: PlayerSlot, players: string[]) => {
      debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
      setAssignedSlot(slot);
      setHasJoined(true);
      setIsInGame(true);
      setGamePlayers(players);
    },
    [setAssignedSlot, setHasJoined, setIsInGame, setGamePlayers]
  );

  const {
    isInQueue,
    queuePosition,
    queueSnapshot,
    isWaitingForApproval,
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
    isWaitingForApproval,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
  };
}
