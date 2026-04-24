"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { getQRSession } from "@/lib/session";
import { getRoomFromUrl, MAX_PLAYERS, type PlayerSlot } from "@/lib/room";
import { TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";
import { socket } from "@/shared/socket";
import { useMobileSocket } from "./hooks/useMobileSocket";
import { useGyroscope } from "./hooks/useGyroscope";
import { usePageLeave } from "./hooks/usePageLeave";
import useNameInputFlow from "./hooks/useNameInputFlow";
import useGameLifecycle from "./hooks/useGameLifecycle";
import useMobileGameSession from "./hooks/useMobileGameSession";
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
  const [canJoinCurrentGame, setCanJoinCurrentGame] = useState<boolean | null>(
    null,
  );
  const finishGameEmittedRef = useRef(false);
  const gameCleanupRef = useRef(false);

  const {
    isInQueue,
    queuePosition,
    queueSnapshot,
    waitingPlayers,
    isWaitingForApproval: hasApprovalWait,
    isHost,
    canStartGame,
    hostApprovalTimeLeft,
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

  const {
    endCountdown,
    finishedPlayers,
    gameFinished,
    gameResult,
    handlePlayerFinished,
    handlePlayerScored,
    handleSocketGameFinished,
    playerScores,
    resetRoundState: resetSessionRoundState,
    setGameResult,
  } = useMobileGameSession({
    isInGame,
    gamePlayers,
  });

  const resetRoundState = useCallback(() => {
    resetSessionRoundState();
    finishGameEmittedRef.current = false;
    gameCleanupRef.current = false;
  }, [resetSessionRoundState]);

  const handleRoomFull = useCallback(
    (data: { room?: string; maxPlayers?: number }) => {
      setStartError(
        data.maxPlayers
          ? `방 정원이 가득 찼습니다. 최대 ${data.maxPlayers}명까지 참여할 수 있습니다.`
          : "방 정원이 가득 찼습니다.",
      );
      setIsInGame(false);
      setHasJoined(false);
      setAssignedSlot(null);
      setGamePlayers([]);
      resetRoundState();
    },
    [resetRoundState],
  );

  const handleRoomPlayersUpdated = useCallback(
    (data: {
      playerCount: number;
      players?: Array<{ socketId: string; name: string }>;
    }) => {
      setCanJoinCurrentGame(data.playerCount < MAX_PLAYERS);
    },
    [],
  );

  const {
    emitAimUpdate,
    emitAimOff,
    emitThrowDart,
    cleanupGameSocket,
    leaveGame,
    socketId,
  } = useMobileSocket({
    room,
    name: socketName,
    enabled: hasJoined,
    slot: assignedSlot,
    roomJoinedBeforeGame: true,
    onPlayerFinished: handlePlayerFinished,
    onPlayerScored: handlePlayerScored,
    onGameResult: setGameResult,
    onRoomFull: handleRoomFull,
    onRoomPlayersUpdated: handleRoomPlayersUpdated,
    onGameFinished: handleSocketGameFinished,
  });

  const {
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

  usePageLeave({ joinedQueueRef });

  useEffect(() => {
    if (!socketId || !hasFinishedTurn) return;

    const timerId = window.setTimeout(() => {
      handlePlayerFinished(socketId);
    }, TURN_RESULT_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [
    handlePlayerFinished,
    hasFinishedTurn,
    socketId,
  ]);

  useEffect(() => {
    if (sessionValid !== true || isInQueue || isInGame) return;

    const updateJoinAvailability = (queue: string[]) => {
      const uniqueQueue = Array.from(new Set(queue));
      setCanJoinCurrentGame(uniqueQueue.length < MAX_PLAYERS);
    };

    const handleGameStarted = () => {
      setCanJoinCurrentGame(false);
      setGameResult(null);
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
  }, [isInGame, isInQueue, room, sessionValid, setGameResult]);

  useGameLifecycle({
    stopSensors,
  });

  useEffect(() => {
    if (!gameFinished || finishGameEmittedRef.current) return;
    if (!socketId || gamePlayers[0] !== socketId) return;

    const scores = gamePlayers.map((playerId) => {
      const entry = playerScores.get(playerId);
      return {
        socketId: playerId,
        name: entry?.name ?? playerId,
        score: entry?.score ?? 0,
      };
    });

    finishGameEmittedRef.current = true;
    socket.emit("finish-game", { room, scores });
  }, [gameFinished, gamePlayers, playerScores, room, socketId]);

  useEffect(() => {
    if (!gameFinished || gameCleanupRef.current) return;

    gameCleanupRef.current = true;
    cleanupGameSocket("game finished");
    leaveQueue();
  }, [cleanupGameSocket, gameFinished, leaveQueue]);

  useEffect(() => {
    if (endCountdown === null || endCountdown > 0) return;

    const timer = window.setTimeout(() => {
      handleExit();
      setGamePlayers([]);
      resetRoundState();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [endCountdown, handleExit, resetRoundState]);

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

  useEffect(() => {
    if (!myTurn || sensorsReady) return;
    startSensors();
  }, [myTurn, sensorsReady, startSensors]);

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

  const renderWaitingPlayers = () => {
    if (waitingPlayers.length === 0) return null;

    return (
      <div className="mt-6 w-[min(82vw,320px)] rounded-xl border border-black/10 bg-white/65 p-4 text-left shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">
            참가자 대기 목록
          </span>
          <span className="rounded-md bg-black/6 px-2 py-1 text-xs font-bold text-neutral-600 tabular-nums">
            {waitingPlayers.length}/{MAX_PLAYERS}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {waitingPlayers.map((player, index) => {
            const isMe = player.socketId === socketId;

            return (
              <div
                key={player.socketId}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  isMe ? "bg-[#FFD700]/25" : "bg-black/5",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/8 text-xs font-bold text-neutral-700">
                  {player.slot ?? index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">
                  {player.name}
                </span>
                {isMe && (
                  <span className="shrink-0 rounded-md bg-[#FFD700] px-2 py-1 text-[11px] font-bold text-black">
                    나
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-y-auto bg-gradient-to-br from-[#f3f3f1] via-[#ecece8] to-[#d9d9d4] px-5 py-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] text-neutral-900">
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
              ? `게임 시작까지 ${hostApprovalTimeLeft ?? 30}초`
              : "1번 참가자가 게임을 시작할 때까지 기다려주세요."
          }
          actionLabel={isHost ? "게임 시작" : undefined}
          onAction={isHost ? startGame : undefined}
          actionDisabled={!canStartGame}
        >
          {renderWaitingPlayers()}
        </QueueLoading>
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
          score={gameResult?.score ?? totalScore}
          onExit={handleExit}
          countdown={endCountdown}
          serverResult={gameResult}
        />
      )}

      {sessionValid === true && !hasFinishedTurn && isInGame && myTurn && (
        <GameScreen
          slot={assignedSlot}
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
