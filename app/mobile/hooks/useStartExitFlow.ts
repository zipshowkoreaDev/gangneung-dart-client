import { useCallback, useRef } from "react";
import { debugLog } from "@/app/mobile/components/DebugOverlay";

type UseStartExitFlowParams = {
  errorMessage: string;
  setStartError: (value: string) => void;
  setStartStatus: (value: "idle" | "checking-level") => void;
  setLevelSample: (value: { beta: number; gamma: number } | null) => void;
  requestMotionPermission: () => Promise<boolean>;
  connectAndJoinQueue: () => void;
  resetName: () => void;
  leaveQueue: () => void;
  leaveGame: () => void;
  stopSensors: () => void;
  setHasFinishedTurn: (value: boolean) => void;
  setIsInGame: (value: boolean) => void;
  setHasJoined: (value: boolean) => void;
  startSensors: () => void;
};

type UseStartExitFlowReturn = {
  handleStart: () => Promise<void>;
  handleCancelLevelCheck: () => void;
  handleExit: () => void;
  handleRequestPermission: () => Promise<void>;
};

export default function useStartExitFlow({
  errorMessage,
  setStartError,
  setStartStatus,
  setLevelSample,
  requestMotionPermission,
  connectAndJoinQueue,
  resetName,
  leaveQueue,
  leaveGame,
  stopSensors,
  setHasFinishedTurn,
  setIsInGame,
  setHasJoined,
  startSensors,
}: UseStartExitFlowParams): UseStartExitFlowReturn {
  const motionPermissionRef = useRef(false);
  const levelCleanupRef = useRef<(() => void) | null>(null);
  const levelResolveRef = useRef<((value: boolean) => void) | null>(null);
  const levelCheckCanceledRef = useRef(false);

  const cancelLevelCheck = useCallback(() => {
    levelCheckCanceledRef.current = true;
    if (levelResolveRef.current) {
      levelResolveRef.current(false);
      levelResolveRef.current = null;
    }
    if (levelCleanupRef.current) {
      levelCleanupRef.current();
      levelCleanupRef.current = null;
    }
    setLevelSample(null);
  }, [setLevelSample]);

  const waitUntilLevel = useCallback((threshold = 7, stableMs = 400) => {
    return new Promise<boolean>((resolve) => {
      levelCheckCanceledRef.current = false;
      levelResolveRef.current = resolve;
      let inRangeSince: number | null = null;

      const handleOrientation = (e: DeviceOrientationEvent) => {
        const sample = { beta: e.beta ?? 0, gamma: e.gamma ?? 0 };
        setLevelSample(sample);

        const isLevel =
          Math.abs(sample.beta) <= threshold &&
          Math.abs(sample.gamma) <= threshold;
        const now = performance.now();
        if (isLevel) {
          if (inRangeSince === null) inRangeSince = now;
          if (now - inRangeSince >= stableMs) {
            if (levelCleanupRef.current) {
              levelCleanupRef.current();
              levelCleanupRef.current = null;
            }
            setLevelSample(null);
            levelResolveRef.current = null;
            resolve(true);
          }
        } else {
          inRangeSince = null;
        }
      };

      const cleanup = () => {
        window.removeEventListener("deviceorientation", handleOrientation);
      };

      levelCleanupRef.current = cleanup;
      window.addEventListener("deviceorientation", handleOrientation);

      return cleanup;
    });
  }, [setLevelSample]);

  const handleStart = useCallback(async () => {
    debugLog("=== handleStart ===");
    setStartError("");
    setHasFinishedTurn(false);

    if (errorMessage) return;

    if (!motionPermissionRef.current) {
      try {
        const hasPermission = await requestMotionPermission();
        debugLog(`motion permission: ${hasPermission}`);
        if (!hasPermission) return;
        motionPermissionRef.current = true;
      } catch (error) {
        debugLog(`motion permission error: ${error}`);
        return;
      }
    }

    cancelLevelCheck();
    setStartStatus("checking-level");
    const isLevel = await waitUntilLevel(5, 1000);
    if (!isLevel) {
      setStartStatus("idle");
      if (!levelCheckCanceledRef.current) {
        setStartError("기기를 평평하게 맞춰주세요.");
      }
      return;
    }
    setStartStatus("idle");

    connectAndJoinQueue();
  }, [
    errorMessage,
    setStartError,
    setStartStatus,
    requestMotionPermission,
    setHasFinishedTurn,
    connectAndJoinQueue,
    waitUntilLevel,
    cancelLevelCheck,
  ]);

  const handleExit = useCallback(() => {
    debugLog("=== handleExit ===");
    setStartError("");
    setStartStatus("idle");
    setLevelSample(null);
    cancelLevelCheck();
    setHasFinishedTurn(false);
    resetName();
    setIsInGame(false);
    setHasJoined(false);
    leaveQueue();
    leaveGame();
    stopSensors();
  }, [
    setHasFinishedTurn,
    resetName,
    setIsInGame,
    setHasJoined,
    leaveQueue,
    leaveGame,
    stopSensors,
    setStartError,
    setStartStatus,
    setLevelSample,
    cancelLevelCheck,
  ]);

  const handleCancelLevelCheck = useCallback(() => {
    setStartError("");
    setStartStatus("idle");
    setLevelSample(null);
    cancelLevelCheck();
  }, [setStartError, setStartStatus, setLevelSample, cancelLevelCheck]);

  const handleRequestPermission = useCallback(async () => {
    try {
      const ok = await requestMotionPermission();
      if (ok) {
        motionPermissionRef.current = true;
        startSensors();
      }
    } catch (error) {
      debugLog(`permission error: ${error}`);
    }
  }, [requestMotionPermission, startSensors]);

  return {
    handleStart,
    handleCancelLevelCheck,
    handleExit,
    handleRequestPermission,
  };
}
