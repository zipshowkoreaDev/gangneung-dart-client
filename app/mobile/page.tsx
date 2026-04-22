"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useMobileSocket } from "./hooks/useMobileSocket";
import { useGyroscope } from "./hooks/useGyroscope";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl, MAX_PLAYERS, type PlayerSlot } from "@/lib/room";
import { socket } from "@/shared/socket";
import { usePageLeave } from "./hooks/usePageLeave";
import useNameInputFlow from "./hooks/useNameInputFlow";
import useGameLifecycle from "./hooks/useGameLifecycle";
import useRadiusParam from "./hooks/useRadiusParam";
import useQueueSessionFlow from "./hooks/useQueueSessionFlow";
import useStartExitFlow from "./hooks/useStartExitFlow";
import { TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";
import SessionValidating from "./components/SessionValidating";
import AccessDenied from "./components/AccessDenied";
import NameInput from "./components/NameInput";
import GameScreen from "./components/GameScreen";
import ResultScreen from "./components/ResultScreen";
import WaitingScreen from "./components/WaitingScreen";
import QueueLoading from "./components/QueueLoading";

export default function MobilePage() {
  const [sessionValid] = useState<boolean | null>(() =>
    getQRSession() !== null ? true : false,
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
    () => new Set(),
  );
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const [canJoinCurrentGame, setCanJoinCurrentGame] = useState<boolean | null>(
    null,
  );

  const handlePlayerFinished = useCallback((playerId: string) => {
    setFinishedPlayers((prev) => {
      if (prev.has(playerId)) return prev;
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
  }, []);

  const { emitAimUpdate, emitAimOff, emitThrowDart, leaveGame, socketId } =
    useMobileSocket({
      room,
      name: socketName,
      enabled: hasJoined,
      slot: assignedSlot,
      onPlayerFinished: handlePlayerFinished,
    });

  const {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
    dartTimeLeft,
    hasFinishedTurn,
    totalScore,
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
    isWaitingForApproval: hasApprovalWait,
    isHost,
    canStartGame,
    joinedQueueRef,
    connectAndJoinQueue,
    leaveQueue,
    startGame,
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

  useEffect(() => {
    if (sessionValid !== true || isInQueue || isInGame) return;

    const updateJoinAvailability = (queue: string[]) => {
      const uniqueQueue = Array.from(new Set(queue));
      setCanJoinCurrentGame(uniqueQueue.length < MAX_PLAYERS);
    };

    const handleGameStarted = () => {
      setCanJoinCurrentGame(false);
    };

    const handleGameEnded = () => {
      setCanJoinCurrentGame(true);
      socket.emit("status-queue");
    };

    if (!socket.connected) {
      socket.io.opts.query = { room, name: "_mobile_status" };
      socket.connect();
    }

    socket.on("status-queue", updateJoinAvailability);
    socket.on("game-started", handleGameStarted);
    socket.on("game-finished", handleGameEnded);
    socket.on("reset-queue", handleGameEnded);
    socket.emit("status-queue");

    const timerId = window.setInterval(() => {
      if (socket.connected) {
        socket.emit("status-queue");
      }
    }, 3000);

    return () => {
      window.clearInterval(timerId);
      socket.off("status-queue", updateJoinAvailability);
      socket.off("game-started", handleGameStarted);
      socket.off("game-finished", handleGameEnded);
      socket.off("reset-queue", handleGameEnded);
    };
  }, [isInGame, isInQueue, room, sessionValid]);

  useGameLifecycle({
    stopSensors,
  });

  const { handleStart, handleExit, handleRequestPermission } = useStartExitFlow(
    {
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
    },
  );

  const myPlayerIndex = useMemo(
    () => (socketId ? gamePlayers.indexOf(socketId) : -1),
    [gamePlayers, socketId],
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
    const timerId = window.setTimeout(
      () => handlePlayerFinished(socketId),
      TURN_RESULT_DELAY_MS,
    );
    return () => window.clearTimeout(timerId);
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
        setEndCountdown(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown, handleExit]);

  const handleNameChange = useCallback(
    (value: string) => {
      if (startError) setStartError("");
      setCustomName(value);
    },
    [setCustomName, startError],
  );

  const isWaitingInQueue =
    isInQueue &&
    !isInGame &&
    queuePosition !== null &&
    queuePosition >= MAX_PLAYERS;
  const isWaitingForApproval =
    isInQueue &&
    !isInGame &&
    queuePosition !== null &&
    queuePosition >= 0 &&
    queuePosition < MAX_PLAYERS &&
    hasApprovalWait;
  const shouldBlockNewEntry =
    sessionValid === true &&
    !isInQueue &&
    !hasFinishedTurn &&
    !isInGame &&
    canJoinCurrentGame === false;
  const isCheckingJoinAvailability =
    sessionValid === true &&
    !isInQueue &&
    !hasFinishedTurn &&
    !isInGame &&
    canJoinCurrentGame === null;
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-y-auto bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5 py-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
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
          title={isHost ? "참가자 대기 중" : "게임 시작 대기 중"}
          message={
            isHost
              ? "참가자가 준비되면 게임을 시작하세요."
              : "1번 참가자가 게임을 시작할 때까지 기다려주세요."
          }
          actionLabel={isHost ? "게임 시작" : undefined}
          onAction={isHost ? startGame : undefined}
          actionDisabled={!canStartGame}
        />
      )}

      {sessionValid === true && hasFinishedTurn && !gameFinished && (
        <QueueLoading
          title="다른 플레이어 진행 중"
          message="모든 플레이어가 끝날 때까지 기다려주세요."
        />
      )}

      {sessionValid === true && gameFinished && (
        <ResultScreen
          name={customName}
          score={totalScore}
          onExit={handleExit}
          countdown={endCountdown}
        />
      )}

      {sessionValid === true && !hasFinishedTurn && isInGame && myTurn && (
        <GameScreen
          aimPosition={aimPosition}
          throwsLeft={throwsLeft}
          dartTimeLeft={dartTimeLeft}
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

      {shouldBlockNewEntry && (
        <QueueLoading
          title="현재 참여할 수 없습니다"
          message="이번 게임이 끝나면 다시 참여할 수 있습니다."
        />
      )}

      {isCheckingJoinAvailability && (
        <QueueLoading
          title="참여 상태 확인 중"
          message="현재 게임 참가 가능 여부를 확인하고 있습니다."
        />
      )}

      {sessionValid === true &&
        !isInQueue &&
        !hasFinishedTurn &&
        !isInGame &&
        canJoinCurrentGame === true && (
          <NameInput
            name={customName}
            onNameChange={handleNameChange}
            onStart={handleStart}
            errorMessage={errorMessage || startError}
          />
        )}

      {sessionValid === true &&
        isInQueue &&
        !isInGame &&
        queuePosition === null && <QueueLoading />}
    </div>
  );
}
