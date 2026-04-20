import { useEffect } from "react";

type UseGameLifecycleParams = {
  stopSensors: () => void;
};

export default function useGameLifecycle({
  stopSensors,
}: UseGameLifecycleParams) {
  useEffect(() => {
    return () => stopSensors();
  }, [stopSensors]);
}
