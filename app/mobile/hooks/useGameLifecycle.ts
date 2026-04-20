import { useEffect } from "react";

type UseGameLifecycleParams = {
  hasFinishedTurn: boolean;
  isInQueue: boolean;
  leaveQueue: () => void;
  stopSensors: () => void;
};

export default function useGameLifecycle({
  hasFinishedTurn,
  isInQueue,
  leaveQueue,
  stopSensors,
}: UseGameLifecycleParams) {
  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);

  useEffect(() => {
    if (!hasFinishedTurn || !isInQueue) return;
    const timer = setTimeout(() => {
      leaveQueue();
    }, 0);
    return () => clearTimeout(timer);
  }, [hasFinishedTurn, isInQueue, leaveQueue]);
}
