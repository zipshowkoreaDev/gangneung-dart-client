"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import {
  getAllPlayerRooms,
  getSlotFromPosition,
  MAX_PLAYERS,
  type PlayerSlot,
} from "@/lib/room";
import { debugLog } from "@/app/mobile/debugLog";

const QUEUE_TIMEOUT_MS = 2 * 60 * 1000;
const HOST_APPROVAL_TIMEOUT_MS = 30 * 1000;
const GAME_STARTED_EVENT = "game-started";
const START_GAME_EVENT = "start-game";

interface UseQueueProps {
  room: string;
  name: string;
  isInGame: boolean;
  onEnterGame: (slot: PlayerSlot, players: string[]) => void;
}

interface UseQueueReturn {
  isInQueue: boolean;
  queuePosition: number | null;
  queueSnapshot: string[] | null;
  isWaitingForApproval: boolean;
  isHost: boolean;
  canStartGame: boolean;
  hostApprovalTimeLeft: number | null;
  joinedQueueRef: React.MutableRefObject<boolean>;
  leaveQueue: () => void;
  connectAndJoinQueue: () => void;
  startGame: () => void;
}

// 대기열 관리 hook
export function useQueue({
  room,
  name,
  isInGame,
  onEnterGame,
}: UseQueueProps): UseQueueReturn {
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<string[] | null>(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [canStartGame, setCanStartGame] = useState(false);
  const [hostApprovalTimeLeft, setHostApprovalTimeLeft] = useState<number | null>(
    null,
  );
  const joinedQueueRef = useRef(false);
  const lastRejoinAtRef = useRef(0);
  const queueStartAtRef = useRef<number | null>(null);
  const lastJoinedSocketIdRef = useRef<string | null>(null);
  const startRequestedRef = useRef(false);
  const queueSnapshotRef = useRef<string[]>([]);
  const hostApprovalDeadlineRef = useRef<number | null>(null);

  const clearApprovalWait = useCallback(() => {
    setIsWaitingForApproval(false);
    setIsHost(false);
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    hostApprovalDeadlineRef.current = null;
  }, []);

  const leaveQueue = useCallback(() => {
    if (joinedQueueRef.current) {
      debugLog("[Queue] leave-queue emit");
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    }
    setIsInQueue(false);
    setQueuePosition(null);
    setQueueSnapshot(null);
    queueSnapshotRef.current = [];
    setIsHost(false);
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    queueStartAtRef.current = null;
    hostApprovalDeadlineRef.current = null;
    startRequestedRef.current = false;
    clearApprovalWait();
  }, [clearApprovalWait]);

  const connectAndJoinQueue = useCallback(() => {
    if (socket.connected) {
      debugLog("[Queue] 기존 소켓 연결 해제 후 재연결");
      socket.emit("leave-queue");
      socket.disconnect();
      joinedQueueRef.current = false;
      lastJoinedSocketIdRef.current = null;
    }
    clearApprovalWait();
    debugLog("[Socket] 연결 시도...");
    socket.io.opts.query = { room, name };
    socket.connect();
    setIsInQueue(true);
    queueStartAtRef.current = Date.now();
  }, [clearApprovalWait, room, name]);

  // 대기열 소켓 이벤트 처리
  useEffect(() => {
    if (!isInQueue || isInGame) return;

    debugLog(`[Queue] 대기열 모드, socket: ${socket.connected}`);

    if (!socket.connected) {
      socket.io.opts.query = { room, name };
      socket.connect();
    }

    const findMyPosition = (queue: string[]): number => {
      if (!socket.id) return -1;
      const idx = queue.indexOf(socket.id);
      return idx >= 0 ? idx : -1;
    };

    const enterGame = (slot: PlayerSlot, players: string[]) => {
      clearApprovalWait();
      debugLog(`[Queue] 게임 시작 승인, 슬롯: ${slot}`);
      onEnterGame(slot, players);
    };

    const enterGameFromQueueSnapshot = () => {
      const players = queueSnapshotRef.current.slice(0, MAX_PLAYERS);
      const position = socket.id ? players.indexOf(socket.id) : -1;
      const slot = getSlotFromPosition(position);

      if (!slot) return;

      enterGame(slot, players);
    };

    const startGameWithPlayers = (players: string[]) => {
      const position = socket.id ? players.indexOf(socket.id) : -1;
      const slot = getSlotFromPosition(position);

      if (!slot || position !== 0) {
        startRequestedRef.current = false;
        setCanStartGame(position === 0);
        return;
      }

      debugLog(`[Queue] host start-game: ${JSON.stringify(players)}`);
      socket.emit(START_GAME_EVENT, { room, players });
      socket.emit(GAME_STARTED_EVENT, { room, players });
      setCanStartGame(false);
      startRequestedRef.current = false;
      onEnterGame(slot, players);
    };

    const onStatusQueue = (queue: string[]) => {
      const uniqueQueue = Array.from(new Set(queue));
      debugLog(`[Queue] status-queue: ${JSON.stringify(uniqueQueue)}`);
      setQueueSnapshot(uniqueQueue);
      queueSnapshotRef.current = uniqueQueue;

      const position = findMyPosition(uniqueQueue);
      debugLog(`[Queue] 내 위치: ${position}`);
      setQueuePosition(position);

      if (position < 0 && joinedQueueRef.current) {
        if (socket.id && lastJoinedSocketIdRef.current === socket.id) {
          return;
        }
        const now = Date.now();
        if (now - lastRejoinAtRef.current > 5000) {
          lastRejoinAtRef.current = now;
          debugLog("[Queue] 내 소켓이 큐에 없음 - 재진입 시도");
          socket.emit("leave-queue");
          socket.emit("join-queue");
          joinedQueueRef.current = true;
          if (socket.id) {
            lastJoinedSocketIdRef.current = socket.id;
          }
        }
      }

      const slot = getSlotFromPosition(position);
      if (slot && !isInGame) {
        const host = position === 0;
        setIsHost(host);
        setCanStartGame(host && !startRequestedRef.current);
        setIsWaitingForApproval(true);
        if (host && !startRequestedRef.current) {
          hostApprovalDeadlineRef.current ??=
            Date.now() + HOST_APPROVAL_TIMEOUT_MS;
          setHostApprovalTimeLeft(
            Math.max(
              0,
              Math.ceil(
                (hostApprovalDeadlineRef.current - Date.now()) / 1000,
              ),
            ),
          );
        } else {
          hostApprovalDeadlineRef.current = null;
          setHostApprovalTimeLeft(null);
        }

        if (host && startRequestedRef.current) {
          startGameWithPlayers(uniqueQueue.slice(0, MAX_PLAYERS));
        }
        return;
      }

      clearApprovalWait();
    };

    const onGameStarted = (data: { players?: string[] }) => {
      const players = Array.isArray(data.players)
        ? Array.from(new Set(data.players)).slice(0, MAX_PLAYERS)
        : [];
      const position = socket.id ? players.indexOf(socket.id) : -1;
      const slot = getSlotFromPosition(position);

      if (!slot) {
        clearApprovalWait();
        return;
      }

      enterGame(slot, players);
    };

    const onAimUpdate = (data: { socketId?: string; registration?: boolean }) => {
      if (!data.registration || !data.socketId || data.socketId === socket.id) {
        return;
      }

      const players = queueSnapshotRef.current.slice(0, MAX_PLAYERS);
      if (!players.includes(data.socketId)) return;

      debugLog(`[Queue] registration start detected: ${data.socketId}`);
      enterGameFromQueueSnapshot();
    };

    const onConnect = () => {
      debugLog("[Socket] connected (queue mode)");
      getAllPlayerRooms(room).forEach((playerRoom) => {
        socket.emit("joinRoom", { room: playerRoom, name });
      });

      if (!joinedQueueRef.current || lastJoinedSocketIdRef.current !== socket.id) {
        debugLog("[Queue] join-queue emit");
        socket.emit("join-queue");
        joinedQueueRef.current = true;
        if (socket.id) {
          lastJoinedSocketIdRef.current = socket.id;
        }
      }
      debugLog("[Queue] status-queue 요청");
      socket.emit("status-queue");
    };

    const onConnectError = (err: unknown) => {
      debugLog(`[Socket] connect_error: ${String(err)}`);
    };

    const onError = (err: unknown) => {
      debugLog(`[Socket] error: ${String(err)}`);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onError);
    socket.on("status-queue", onStatusQueue);
    socket.on(GAME_STARTED_EVENT, onGameStarted);
    socket.on("aim-update", onAimUpdate);

    const heartbeatId = window.setInterval(() => {
      if (!socket.connected || !joinedQueueRef.current) return;
      debugLog("[Queue] heartbeat status-queue");
      socket.emit("status-queue");
    }, 8000);

    const timeoutId = window.setInterval(() => {
      if (!joinedQueueRef.current || !queueStartAtRef.current) return;
      const elapsed = Date.now() - queueStartAtRef.current;
      if (elapsed >= QUEUE_TIMEOUT_MS) {
        debugLog("[Queue] 대기열 타임아웃 - 자동 이탈");
        leaveQueue();
      }
    }, 5000);

    const hostApprovalTimerId = window.setInterval(() => {
      const deadline = hostApprovalDeadlineRef.current;
      if (!deadline || !joinedQueueRef.current || startRequestedRef.current) {
        return;
      }

      const timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setHostApprovalTimeLeft(timeLeft);

      if (timeLeft <= 0) {
        debugLog("[Queue] host approval timeout - leave queue");
        leaveQueue();
      }
    }, 250);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      window.clearInterval(heartbeatId);
      window.clearInterval(timeoutId);
      window.clearInterval(hostApprovalTimerId);
      clearApprovalWait();
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("status-queue", onStatusQueue);
      socket.off(GAME_STARTED_EVENT, onGameStarted);
      socket.off("aim-update", onAimUpdate);
    };
  }, [isInQueue, isInGame, name, onEnterGame, room, leaveQueue, clearApprovalWait]);

  const startGame = useCallback(() => {
    if (!isHost || startRequestedRef.current) return;

    startRequestedRef.current = true;
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    hostApprovalDeadlineRef.current = null;
    socket.emit("status-queue");
  }, [isHost]);

  return {
    isInQueue,
    queuePosition,
    queueSnapshot,
    isWaitingForApproval,
    isHost,
    canStartGame,
    hostApprovalTimeLeft,
    joinedQueueRef,
    leaveQueue,
    connectAndJoinQueue,
    startGame,
  };
}
