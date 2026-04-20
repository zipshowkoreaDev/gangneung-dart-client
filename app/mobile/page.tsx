"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useMobileSocket } from "./hooks/useMobileSocket";
import { useGyroscope } from "./hooks/useGyroscope";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl, MAX_PLAYERS, type PlayerSlot } from "@/lib/room";
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
  const [assignedSlot, setAssignedSlot] = useState<PlayerSlot | null>(null);
  const [startError, setStartError] = useState("");
  const [gamePlayers, setGamePlayers] = useState<string[]>([]);
  const [finishedPlayers, setFinishedPlayers] = useState<Set<string>>(
    () => new Set()
  );
  const [winner, setWinner] = useState<{ name: string; score: number } | null>(
    null
  );
  const [endCountdown, setEndCountdown] = useState<number | null>(null);

  const handlePlayerFinished = useCallback((playerId: string) => {
    setFinishedPlayers((prev) => {
      if (prev.has(playerId)) return prev;
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
  }, []);

  const handleGameResult = useCallback(
    (data: {
      ranking?: Array<{ name: string; score: number; rank?: number }>;
    }) => {
      const topPlayer = data.ranking?.[0];
      if (!topPlayer) return;
      setWinner({ name: topPlayer.name, score: topPlayer.score });
    },
    []
  );

  const {
    emitAimUpdate,
    emitAimOff,
    emitThrowDart,
    leaveGame,
    socketId,
  } = useMobileSocket({
    room,
    name: socketName,
    enabled: hasJoined,
    slot: assignedSlot,
    onPlayerFinished: handlePlayerFinished,
    onGameResult: handleGameResult,
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
    isInQueue,
    queuePosition,
    queueSnapshot,
    approvalRemainingSeconds,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
  } = useQueueSessionFlow({
    room,
    name: socketName,
    isInGame,
    setAssignedSlot,
    setHasJoined,
    setIsInGame,
    setGamePlayers,
  });

  usePageLeave({ joinedQueueRef });

  useGameLifecycle({
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

  const myPlayerIndex = useMemo(
    () => (socketId ? gamePlayers.indexOf(socketId) : -1),
    [gamePlayers, socketId]
  );
  const myTurn =
    isInGame &&
    !hasFinishedTurn &&
    myPlayerIndex >= 0 &&
    gamePlayers
      .slice(0, myPlayerIndex)
      .every((playerId) => finishedPlayers.has(playerId));
  const gameFinished =
    isInGame &&
    gamePlayers.length > 0 &&
    gamePlayers.every((playerId) => finishedPlayers.has(playerId));

  useEffect(() => {
    if (!socketId || !hasFinishedTurn) return;
    const timer = window.setTimeout(() => handlePlayerFinished(socketId), 0);
    return () => window.clearTimeout(timer);
  }, [socketId, hasFinishedTurn, handlePlayerFinished]);

  useEffect(() => {
    if (!myTurn || sensorsReady) return;
    startSensors();
  }, [myTurn, sensorsReady, startSensors]);

  useEffect(() => {
    if (!gameFinished || endCountdown !== null) return;
    const timer = window.setTimeout(() => setEndCountdown(10), 0);
    return () => window.clearTimeout(timer);
  }, [gameFinished, endCountdown]);

  useEffect(() => {
    if (endCountdown === null) return;
    if (endCountdown <= 0) {
      const timer = window.setTimeout(() => {
        handleExit();
        setGamePlayers([]);
        setFinishedPlayers(new Set());
        setWinner(null);
        setEndCountdown(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown, handleExit]);

  const handleNameChange = useCallback(
    (value: string) => {
      if (startError) setStartError("");
      setCustomName(value);
    },
    [setCustomName, startError]
  );

  const isWaitingInQueue =
    isInQueue && !isInGame && queuePosition !== null && queuePosition >= MAX_PLAYERS;
  const isWaitingForApproval =
    isInQueue &&
    !isInGame &&
    queuePosition !== null &&
    queuePosition >= 0 &&
    queuePosition < MAX_PLAYERS &&
    approvalRemainingSeconds !== null;
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      <DebugOverlay />
      {sessionValid === null && <SessionValidating />}
      {sessionValid === false && <AccessDenied />}

      {sessionValid === true && isWaitingInQueue && (
        <WaitingScreen
          aheadCount={
            queuePosition !== null
              ? Math.max(0, queuePosition - MAX_PLAYERS)
              : null
          }
          queue={queueSnapshot}
        />
      )}

      {sessionValid === true && isWaitingForApproval && (
        <QueueLoading
          title="플레이어 참여 대기 중"
          message={`${MAX_PLAYERS}명이 모이면 바로 시작합니다. 모이지 않으면 30초 후 자동 시작됩니다.`}
          remainingSeconds={approvalRemainingSeconds}
        />
      )}

      {sessionValid === true && hasFinishedTurn && !gameFinished && (
        <ResultScreen
          name={customName}
          score={myScore}
          onExit={handleExit}
          isWaiting
        />
      )}

      {sessionValid === true && gameFinished && (
        <ResultScreen
          name={customName}
          score={myScore}
          onExit={handleExit}
          countdown={endCountdown}
          winnerName={winner?.name}
          winnerScore={winner?.score}
        />
      )}

      {sessionValid === true && !hasFinishedTurn && isInGame && myTurn && (
        <GameScreen
          aimPosition={aimPosition}
          throwsLeft={throwsLeft}
          sensorsReady={sensorsReady}
          sensorError={sensorError}
          onRequestPermission={handleRequestPermission}
          onCalibrate={calibrate}
        />
      )}

      {sessionValid === true && !hasFinishedTurn && isInGame && !myTurn && (
        <QueueLoading
          title="차례 대기 중"
          message="앞 플레이어의 투구가 끝나면 자동으로 시작됩니다."
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
