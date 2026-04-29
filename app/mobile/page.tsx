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
import useStartExitFlow from "./hooks/useStartExitFlow";
import useWakeLock from "./hooks/useWakeLock";
import SessionValidating from "./components/SessionValidating";
import AccessDenied from "./components/AccessDenied";
import NameInput from "./components/NameInput";
import GameScreen from "./components/GameScreen";
import ResultScreen from "./components/ResultScreen";
import StatusScreen from "./components/StatusScreen";
import { formatDuplicateDisplayNames } from "@/lib/displayName";
import { useLobby } from "./hooks/useLobby";
import { debugLog } from "./lib/debugLog";

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
  const finishGameEmittedRef = useRef(false);

  const handleEnterGame = useCallback(
    (slot: PlayerSlot, players: string[]) => {
      debugLog(`✅ 게임 입장, 슬롯: ${slot}`);
      setAssignedSlot(slot);
      setHasJoined(true);
      setIsInGame(true);
      setGamePlayers(players);
    },
    [setAssignedSlot, setGamePlayers, setHasJoined, setIsInGame],
  );

  const {
    isInLobby,
    lobbyPosition,
    waitingPlayers,
    isWaitingForApproval: hasApprovalWait,
    isHost,
    canStartGame,
    hostApprovalTimeLeft,
    joinedLobbyRef,
    connectAndJoinLobby,
    leaveLobby,
    startGame,
  } = useLobby({
    room,
    name: socketName,
    isInGame,
    onEnterGame: handleEnterGame,
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
    roomJoinedBeforeGame: true,
    onPlayerFinished: handlePlayerFinished,
    onPlayerScored: handlePlayerScored,
    onGameResult: setGameResult,
    onRoomFull: handleRoomFull,
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
    connectAndJoinLobby,
    resetName,
    leaveLobby,
    leaveGame,
    stopSensors,
    setHasFinishedTurn,
    setIsInGame,
    setHasJoined,
    startSensors,
  });

  usePageLeave({
    onLeave: () => {
      if (!joinedLobbyRef.current) return;
      socket.emit("leaveRoom", { room });
      joinedLobbyRef.current = false;
    },
  });
  useWakeLock({ enabled: isInGame && !gameFinished });

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

  const isWaitingForApproval =
    isInLobby &&
    !isInGame &&
    lobbyPosition !== null &&
    lobbyPosition >= 0 &&
    lobbyPosition < MAX_PLAYERS &&
    hasApprovalWait;
  const renderWaitingPlayers = () => {
    if (waitingPlayers.length === 0) return null;
    const displayNames = formatDuplicateDisplayNames(waitingPlayers, (player) => player.name);

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
                  {displayNames[index]}
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

      {sessionValid === true && isWaitingForApproval && (
        <StatusScreen
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
        </StatusScreen>
      )}

      {sessionValid === true && hasFinishedTurn && !gameFinished && (
        <StatusScreen
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
        <StatusScreen
          title="차례 대기 중"
          message="앞 플레이어의 투구가 끝나면 자동으로 시작됩니다."
        />
      )}

      {sessionValid === true &&
        !isInLobby &&
        !hasFinishedTurn &&
        !isInGame && (
          <NameInput
            name={customName}
            onNameChange={handleNameChange}
            onStart={handleStart}
            errorMessage={errorMessage || startError}
          />
        )}

      {sessionValid === true &&
        isInLobby &&
        !isInGame &&
        lobbyPosition === null && <StatusScreen />}
    </div>
  );
}
