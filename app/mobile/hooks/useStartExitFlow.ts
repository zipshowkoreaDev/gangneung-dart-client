import { useCallback, useRef } from "react";
import { debugLog } from "@/app/mobile/debugLog";

type UseStartExitFlowParams = {
  errorMessage: string;
  setStartError: (value: string) => void;
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
  handleExit: () => void;
  handleRequestPermission: () => Promise<void>;
};

export default function useStartExitFlow({
  errorMessage,
  setStartError,
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

    connectAndJoinQueue();
  }, [
    errorMessage,
    setStartError,
    setHasFinishedTurn,
    requestMotionPermission,
    connectAndJoinQueue,
  ]);

  const handleExit = useCallback(() => {
    debugLog("=== handleExit ===");
    setStartError("");
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
  ]);

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
    handleExit,
    handleRequestPermission,
  };
}
