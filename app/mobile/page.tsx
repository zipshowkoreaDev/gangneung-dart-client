"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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

type ScoreEntry = {
  socketId: string;
  name: string;
  score: number;
};
type ControllerGameResult = {
  result: "win" | "lose" | "tie";
  score: number;
  rank: number;
  totalPlayers: number;
};
const GAME_END_COUNTDOWN_SECONDS = 5;

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
  const [playerScores, setPlayerScores] = useState<Map<string, ScoreEntry>>(
    () => new Map(),
  );
  const [gameResult, setGameResult] = useState<ControllerGameResult | null>(
    null,
  );
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const [canJoinCurrentGame, setCanJoinCurrentGame] = useState<boolean | null>(
    null,
  );
  const finishGameEmittedRef = useRef(false);
  const gameCleanupEmittedRef = useRef(false);
  const resetRoundState = useCallback(() => {
    setFinishedPlayers(new Set());
    setPlayerScores(new Map());
    setGameResult(null);
    setEndCountdown(null);
    finishGameEmittedRef.current = false;
    gameCleanupEmittedRef.current = false;
  }, []);

  const handlePlayerFinished = useCallback((playerId: string) => {
    setFinishedPlayers((prev) => {
      if (prev.has(playerId)) return prev;
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
  }, []);
  const handlePlayerScored = useCallback((player: ScoreEntry) => {
    setPlayerScores((prev) => {
      const next = new Map(prev);
      const existing = next.get(player.socketId);
      next.set(player.socketId, {
        socketId: player.socketId,
        name: player.name,
        score: (existing?.score ?? 0) + player.score,
      });
      return next;
    });
  }, []);
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
  const handleSocketGameFinished = useCallback(() => {
    gameCleanupEmittedRef.current = true;
  }, []);

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
    resetRoundState,
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
    const timerId = window.setTimeout(() => {
      setPlayerScores((prev) => {
        const next = new Map(prev);
        next.set(socketId, {
          socketId,
          name: socketName,
          score: totalScore,
        });
        return next;
      });
      handlePlayerFinished(socketId);
    }, TURN_RESULT_DELAY_MS);
    return () => window.clearTimeout(timerId);
  }, [socketId, socketName, hasFinishedTurn, totalScore, handlePlayerFinished]);

  useEffect(() => {
    if (!myTurn || sensorsReady) return;
    startSensors();
  }, [myTurn, sensorsReady, startSensors]);

  useEffect(() => {
    if (!gameFinished || endCountdown !== null) return;
    const timer = window.setTimeout(
      () => setEndCountdown(GAME_END_COUNTDOWN_SECONDS),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [gameFinished, endCountdown]);

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
    if (!gameFinished || gameCleanupEmittedRef.current) return;

    gameCleanupEmittedRef.current = true;
    cleanupGameSocket("game finished");
    leaveQueue();
  }, [cleanupGameSocket, gameFinished, leaveQueue]);

  useEffect(() => {
    if (endCountdown === null) return;
    if (endCountdown <= 0) {
      const timer = window.setTimeout(() => {
        handleExit();
        setGamePlayers([]);
        resetRoundState();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown, handleExit, resetRoundState]);

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
      <div className="mt-6 w-[min(82vw,320px)] rounded-xl border border-white/15 bg-white/10 p-4 text-left shadow-lg backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/80">참가자 대기 목록</span>
          <span className="rounded-md bg-black/20 px-2 py-1 text-xs font-bold text-white/80 tabular-nums">
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
                  isMe ? "bg-[#FFD700]/20" : "bg-white/8",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
                  {player.slot ?? index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
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
