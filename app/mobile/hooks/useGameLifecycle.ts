import { useEffect } from "react";

type UseGameLifecycleParams = {
  isInGame: boolean;
  throwsLeft: number;
  hasFinishedTurn: boolean;
  isInQueue: boolean;
  setHasFinishedTurn: (value: boolean) => void;
  leaveQueue: () => void;
  stopSensors: () => void;
};

export default function useGameLifecycle({
  isInGame,
  throwsLeft,
  hasFinishedTurn,
  isInQueue,
  setHasFinishedTurn,
  leaveQueue,
  stopSensors,
}: UseGameLifecycleParams) {
  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);

  // 3회 던지기 완료 시 결과 화면 전환
  useEffect(() => {
    if (isInGame && throwsLeft === 0 && !hasFinishedTurn) {
      setHasFinishedTurn(true);
    }
  }, [isInGame, throwsLeft, hasFinishedTurn, setHasFinishedTurn]);

  // 게임 종료 시 대기열 이탈
  useEffect(() => {
    if (!hasFinishedTurn || !isInQueue) return;
    const timer = setTimeout(() => {
      leaveQueue();
    }, 0);
    return () => clearTimeout(timer);
  }, [hasFinishedTurn, isInQueue, leaveQueue]);
}
