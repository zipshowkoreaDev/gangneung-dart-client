"use client";

import { useState, useCallback } from "react";
import { useMobileSocket } from "./hooks/useMobileSocket";
import { useGyroscope } from "./hooks/useGyroscope";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl } from "@/lib/room";
import { usePageLeave } from "./hooks/usePageLeave";
import useNameInputFlow from "./hooks/useNameInputFlow";
import useGameLifecycle from "./hooks/useGameLifecycle";
import useRadiusParam from "./hooks/useRadiusParam";
import useQueueSessionFlow from "./hooks/useQueueSessionFlow";
import useStartExitFlow from "./hooks/useStartExitFlow";
import SessionValidating from "./components/SessionValidating";
import AccessDenied from "./components/AccessDenied";
import NameInput from "./components/NameInput";
import GameScreen from "./components/GameScreen";
import ResultScreen from "./components/ResultScreen";
import WaitingScreen from "./components/WaitingScreen";
import QueueLoading from "./components/QueueLoading";
import DebugOverlay from "./components/DebugOverlay";
export default function MobilePage() {
  const [sessionValid] = useState<boolean | null>(() =>
    getQRSession() !== null ? true : false
  );
  const [room] = useState(getRoomFromUrl);
  const {
    name: customName,
    setName: setCustomName,
    socketName,
    errorMessage,
    reset: resetName,
  } = useNameInputFlow();
  const rouletteRadius = useRadiusParam();
  const [isInGame, setIsInGame] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [assignedSlot, setAssignedSlot] = useState<1 | 2 | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [startError, setStartError] = useState("");

  const { emitAimUpdate, emitAimOff, emitThrowDart, leaveGame } = useMobileSocket({
    room,
    name: socketName,
    enabled: hasJoined,
    slot: assignedSlot,
  });

  const {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
    hasFinishedTurn,
    myScore,
    startSensors,
    stopSensors,
    requestMotionPermission,
    setHasFinishedTurn,
    calibrate,
  } = useGyroscope({
    emitAimUpdate,
    emitAimOff,
    emitThrowDart,
    rouletteRadius,
  });

  const {
    queuePosition,
    queueSnapshot,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
  } = useQueueSessionFlow({
    room,
    name: socketName,
    isInGame,
    startSensors,
    setAssignedSlot,
    setHasJoined,
    setIsInGame,
    setIsInQueue,
  });

  usePageLeave({ joinedQueueRef });

  useGameLifecycle({
    hasFinishedTurn,
    isInQueue,
    leaveQueue,
    stopSensors,
  });

  const {
    handleStart,
    handleExit,
    handleRequestPermission,
  } = useStartExitFlow({
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
  });

  const handleNameChange = useCallback(
    (value: string) => {
      if (startError) setStartError("");
      setCustomName(value);
    },
    [setCustomName, startError]
  );

  const isWaitingInQueue =
    isInQueue && !isInGame && queuePosition !== null && queuePosition >= 2;
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      <DebugOverlay />
      {sessionValid === null && <SessionValidating />}
      {sessionValid === false && <AccessDenied />}

      {sessionValid === true && isWaitingInQueue && (
        <WaitingScreen
          aheadCount={queuePosition !== null ? Math.max(0, queuePosition - 2) : null}
          queue={queueSnapshot}
        />
      )}

      {sessionValid === true && hasFinishedTurn && (
        <ResultScreen name={customName} score={myScore} onExit={handleExit} />
      )}

      {sessionValid === true && !hasFinishedTurn && isInGame && (
        <GameScreen
          aimPosition={aimPosition}
          throwsLeft={throwsLeft}
          sensorsReady={sensorsReady}
          sensorError={sensorError}
          onRequestPermission={handleRequestPermission}
          onCalibrate={calibrate}
        />
      )}

      {sessionValid === true && !isInQueue && !hasFinishedTurn && !isInGame && (
        <NameInput
          name={customName}
          onNameChange={handleNameChange}
          onStart={handleStart}
          errorMessage={errorMessage || startError}
        />
      )}

      {sessionValid === true && isInQueue && !isInGame && queuePosition === null && (
        <QueueLoading />
      )}
    </div>
  );
}
