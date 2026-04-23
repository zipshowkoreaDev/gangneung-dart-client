import { useCallback } from "react";
import { useQueue } from "@/app/mobile/hooks/useQueue";
import { debugLog } from "@/app/mobile/debugLog";
import type { PlayerSlot } from "@/lib/room";
import type { WaitingPlayer } from "@/app/mobile/hooks/useQueue";

type UseQueueSessionFlowParams = {
  room: string;
  name: string;
  isInGame: boolean;
  resetRoundState: () => void;
  setAssignedSlot: (value: PlayerSlot | null) => void;
  setHasJoined: (value: boolean) => void;
  setIsInGame: (value: boolean) => void;
  setGamePlayers: (value: string[]) => void;
};

type UseQueueSessionFlowReturn = {
  isInQueue: boolean;
  queuePosition: number | null;
  queueSnapshot: string[] | null;
  waitingPlayers: WaitingPlayer[];
  isWaitingForApproval: boolean;
  isHost: boolean;
  canStartGame: boolean;
  hostApprovalTimeLeft: number | null;
  joinedQueueRef: React.MutableRefObject<boolean>;
  connectAndJoinQueue: () => void;
  leaveQueue: () => void;
  startGame: () => void;
};

export default function useQueueSessionFlow({
  room,
  name,
  isInGame,
  resetRoundState,
  setAssignedSlot,
  setHasJoined,
  setIsInGame,
  setGamePlayers,
}: UseQueueSessionFlowParams): UseQueueSessionFlowReturn {
  const handleEnterGame = useCallback(
    (slot: PlayerSlot, players: string[]) => {
      debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
      resetRoundState();
      setAssignedSlot(slot);
      setHasJoined(true);
      setIsInGame(true);
      setGamePlayers(players);
    },
    [resetRoundState, setAssignedSlot, setHasJoined, setIsInGame, setGamePlayers]
  );

  const {
    isInQueue,
    queuePosition,
    queueSnapshot,
    waitingPlayers,
    isWaitingForApproval,
    isHost,
    canStartGame,
    hostApprovalTimeLeft,
    joinedQueueRef,
    leaveQueue,
    connectAndJoinQueue,
    startGame,
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
    waitingPlayers,
    isWaitingForApproval,
    isHost,
    canStartGame,
    hostApprovalTimeLeft,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
    startGame,
  };
}
