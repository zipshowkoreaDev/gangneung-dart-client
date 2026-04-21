"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import { getSlotFromPosition, MAX_PLAYERS, type PlayerSlot } from "@/lib/room";
import { debugLog } from "../components/DebugOverlay";

const QUEUE_TIMEOUT_MS = 2 * 60 * 1000;
const AUTO_APPROVAL_DELAY_MS = 30 * 1000;

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
  joinedQueueRef: React.MutableRefObject<boolean>;
  leaveQueue: () => void;
  connectAndJoinQueue: () => void;
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
  const joinedQueueRef = useRef(false);
  const lastRejoinAtRef = useRef(0);
  const queueStartAtRef = useRef<number | null>(null);
  const approvalStartAtRef = useRef<number | null>(null);
  const approvalTimeoutRef = useRef<number | null>(null);
  const pendingSlotRef = useRef<PlayerSlot | null>(null);
  const pendingPlayersRef = useRef<string[]>([]);
  const lastJoinedSocketIdRef = useRef<string | null>(null);

  const clearApprovalWait = useCallback(() => {
    if (approvalTimeoutRef.current !== null) {
      window.clearTimeout(approvalTimeoutRef.current);
      approvalTimeoutRef.current = null;
    }
    approvalStartAtRef.current = null;
    pendingSlotRef.current = null;
    pendingPlayersRef.current = [];
    setIsWaitingForApproval(false);
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
    queueStartAtRef.current = null;
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

    const getGamePlayers = (queue: string[]) => queue.slice(0, MAX_PLAYERS);

    const enterGame = (slot: PlayerSlot, players: string[]) => {
      clearApprovalWait();
      debugLog(`[Queue] 게임 시작 승인, 슬롯: ${slot}`);
      onEnterGame(slot, players);
    };

    const waitForAutoApproval = (slot: PlayerSlot, players: string[]) => {
      pendingSlotRef.current = slot;
      pendingPlayersRef.current = players;

      if (!approvalStartAtRef.current) {
        approvalStartAtRef.current = Date.now();
        debugLog("[Queue] 자동 승인 대기 시작");
      }

      setIsWaitingForApproval(true);

      if (approvalTimeoutRef.current === null) {
        const elapsed = Date.now() - approvalStartAtRef.current;
        const remaining = Math.max(0, AUTO_APPROVAL_DELAY_MS - elapsed);
        approvalTimeoutRef.current = window.setTimeout(() => {
          const approvedSlot = pendingSlotRef.current;
          if (approvedSlot && !isInGame) {
            enterGame(approvedSlot, pendingPlayersRef.current);
          }
        }, remaining);
      }
    };

    const onStatusQueue = (queue: string[]) => {
      const uniqueQueue = Array.from(new Set(queue));
      debugLog(`[Queue] status-queue: ${JSON.stringify(uniqueQueue)}`);
      setQueueSnapshot(uniqueQueue);

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
        if (uniqueQueue.length >= MAX_PLAYERS) {
          debugLog(`[Queue] 4명 충족 - 즉시 시작, 슬롯: ${slot}`);
          enterGame(slot, getGamePlayers(uniqueQueue));
          return;
        }

        debugLog(`[Queue] 자동 승인 대기 중, 슬롯: ${slot}`);
        waitForAutoApproval(slot, getGamePlayers(uniqueQueue));
        return;
      }

      clearApprovalWait();
    };

    const onConnect = () => {
      debugLog("[Socket] connected (queue mode)");
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

    if (socket.connected) {
      onConnect();
    }

    return () => {
      window.clearInterval(heartbeatId);
      window.clearInterval(timeoutId);
      clearApprovalWait();
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("status-queue", onStatusQueue);
    };
  }, [isInQueue, isInGame, name, onEnterGame, room, leaveQueue, clearApprovalWait]);

  return {
    isInQueue,
    queuePosition,
    queueSnapshot,
    isWaitingForApproval,
    joinedQueueRef,
    leaveQueue,
    connectAndJoinQueue,
  };
}
