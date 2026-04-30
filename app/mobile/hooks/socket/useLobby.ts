"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "@/shared/socket";
import {
  getSlotFromPosition,
  MAX_PLAYERS,
  type PlayerSlot,
} from "@/lib/room";
import { debugLog } from "@/app/mobile/lib/debugLog";
import { stripDisplayName } from "@/lib/displayName";

const LOBBY_TIMEOUT_MS = 2 * 60 * 1000;
const HOST_APPROVAL_TIMEOUT_MS = 30 * 1000;
interface UseLobbyProps {
  room: string;
  name: string;
  isInGame: boolean;
  onEnterGame: (slot: PlayerSlot, players: string[]) => void;
  onDisconnectNotice: (notice: { title: string; message: string }) => void;
}

export type WaitingPlayer = {
  socketId: string;
  name: string;
  slot: PlayerSlot | null;
};

interface UseLobbyReturn {
  isInLobby: boolean;
  lobbyPosition: number | null;
  waitingPlayers: WaitingPlayer[];
  isWaitingForApproval: boolean;
  isHost: boolean;
  canStartGame: boolean;
  hostApprovalTimeLeft: number | null;
  joinedLobbyRef: React.MutableRefObject<boolean>;
  leaveLobby: () => void;
  connectAndJoinLobby: () => void;
  startGame: () => void;
}

export function useLobby({
  room,
  name,
  isInGame,
  onEnterGame,
  onDisconnectNotice,
}: UseLobbyProps): UseLobbyReturn {
  const [isInLobby, setIsInLobby] = useState(false);
  const [lobbyPosition, setLobbyPosition] = useState<number | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<string[] | null>(null);
  const [lobbyPlayerNames, setLobbyPlayerNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [canStartGame, setCanStartGame] = useState(false);
  const [hostApprovalTimeLeft, setHostApprovalTimeLeft] = useState<number | null>(
    null,
  );
  const [hostApprovalDeadline, setHostApprovalDeadline] = useState<number | null>(
    null,
  );
  const joinedLobbyRef = useRef(false);
  const lobbyStartAtRef = useRef<number | null>(null);
  const startRequestedRef = useRef(false);
  const lobbyPlayersRef = useRef<string[]>([]);
  const lobbyOrderRef = useRef<string[]>([]);
  const joinedRoomRef = useRef(false);
  const pendingDisconnectNoticeRef = useRef<{
    title: string;
    message: string;
  } | null>(null);
  const suppressDisconnectNoticeRef = useRef(false);

  const clearApprovalWait = useCallback(() => {
    setIsWaitingForApproval(false);
    setIsHost(false);
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    setHostApprovalDeadline(null);
  }, []);

  const resetLobbyState = useCallback(() => {
    joinedRoomRef.current = false;
    joinedLobbyRef.current = false;
    lobbyPlayersRef.current = [];
    lobbyOrderRef.current = [];
    lobbyStartAtRef.current = null;
    startRequestedRef.current = false;
    setIsInLobby(false);
    setLobbyPosition(null);
    setLobbyPlayers(null);
    setLobbyPlayerNames(new Map());
    clearApprovalWait();
  }, [clearApprovalWait]);

  const leaveLobby = useCallback(() => {
    suppressDisconnectNoticeRef.current = true;
    if (socket.connected) {
      debugLog("[Lobby] socket disconnect");
      socket.disconnect();
    }
    resetLobbyState();
  }, [resetLobbyState]);

  const leaveLobbyWithNotice = useCallback(
    (notice: { title: string; message: string }) => {
      pendingDisconnectNoticeRef.current = notice;
      suppressDisconnectNoticeRef.current = false;
      if (socket.connected) {
        debugLog(`[Lobby] socket disconnect with notice: ${notice.title}`);
        socket.disconnect();
        return;
      }
      resetLobbyState();
      onDisconnectNotice(notice);
      pendingDisconnectNoticeRef.current = null;
    },
    [onDisconnectNotice, resetLobbyState],
  );

  const connectAndJoinLobby = useCallback(() => {
    if (socket.connected) {
      debugLog("[Lobby] 기존 소켓 연결 해제 후 재연결");
      socket.disconnect();
      joinedLobbyRef.current = false;
      joinedRoomRef.current = false;
    }
    clearApprovalWait();
    debugLog("[Socket] 연결 시도...");
    socket.io.opts.query = { room, name };
    socket.connect();
    setIsInLobby(true);
    lobbyStartAtRef.current = Date.now();
  }, [clearApprovalWait, room, name]);

  useEffect(() => {
    if (!isInLobby || isInGame) return;

    debugLog(`[Lobby] 대기 모드, socket: ${socket.connected}`);

    if (!socket.connected) {
      socket.io.opts.query = { room, name };
      socket.connect();
    }

    const findMyPosition = (players: string[]): number => {
      if (!socket.id) return -1;
      const idx = players.indexOf(socket.id);
      return idx >= 0 ? idx : -1;
    };

    const enterGame = (slot: PlayerSlot, players: string[]) => {
      clearApprovalWait();
      joinedRoomRef.current = false;
      debugLog(`[Lobby] 게임 시작 승인, 슬롯: ${slot}`);
      onEnterGame(slot, players);
    };

    const enterGameFromLobbySnapshot = () => {
      const players = lobbyPlayersRef.current.slice(0, MAX_PLAYERS);
      const position = socket.id ? players.indexOf(socket.id) : -1;
      const slot = getSlotFromPosition(position);

      if (!slot) return;

      enterGame(slot, players);
    };

    const joinRoomIfNeeded = () => {
      if (!socket.connected || !socket.id || joinedRoomRef.current) return;

      debugLog(`[Lobby] joinRoom emit: ${room}, name: ${name}`);
      socket.emit("joinRoom", { room, name });
      joinedRoomRef.current = true;
    };

    const syncLobbyState = (
      players: Array<{ socketId: string; name: string }> | undefined,
      playerCount?: number,
    ) => {
      const incomingSocketIds = Array.from(
        new Set(
          (players ?? [])
            .map((player) => player.socketId)
            .filter((socketId): socketId is string => Boolean(socketId)),
        ),
      );
      const expectedPlayerCount = Math.min(
        Math.max(playerCount ?? incomingSocketIds.length, 0),
        MAX_PLAYERS,
      );
      const hasFullSnapshot =
        incomingSocketIds.length >= expectedPlayerCount ||
        lobbyOrderRef.current.length === 0;
      const incomingSocketIdSet = new Set(incomingSocketIds);
      const preservedOrder = hasFullSnapshot
        ? lobbyOrderRef.current.filter((socketId) => incomingSocketIdSet.has(socketId))
        : lobbyOrderRef.current.slice(0, expectedPlayerCount);
      const appendedOrder = incomingSocketIds.filter(
        (socketId) => !preservedOrder.includes(socketId),
      );
      const maxLength = hasFullSnapshot
        ? MAX_PLAYERS
        : Math.max(preservedOrder.length, expectedPlayerCount);
      const lobbySocketIds = [...preservedOrder, ...appendedOrder].slice(0, maxLength);
      lobbyOrderRef.current = lobbySocketIds;

      debugLog(`[Lobby] players: ${JSON.stringify(lobbySocketIds)}`);
      setLobbyPlayers(lobbySocketIds);
      lobbyPlayersRef.current = lobbySocketIds;
      setLobbyPlayerNames((prev) => {
        const next = new Map(prev);
        const currentSocketIds = new Set(lobbySocketIds);
        let changed = false;

        players?.forEach((player) => {
          const displayName = stripDisplayName(player.name);
          if (next.get(player.socketId) === displayName) return;
          next.set(player.socketId, displayName);
          changed = true;
        });

        Array.from(next.keys()).forEach((socketId) => {
          if (hasFullSnapshot && !currentSocketIds.has(socketId)) {
            next.delete(socketId);
            changed = true;
          }
        });

        return changed ? next : prev;
      });

      const position = findMyPosition(lobbySocketIds);
      debugLog(`[Lobby] 내 위치: ${position}`);
      setLobbyPosition(position);

      if (position < 0 && joinedLobbyRef.current) {
        debugLog("[Lobby] 내 소켓이 방 목록에 아직 없음 - 현재 로비 상태 유지");
        clearApprovalWait();
        return;
      }

      const slot = getSlotFromPosition(position);
      if (slot && !isInGame) {
        const host = position === 0;
        setIsHost(host);
        setCanStartGame(host && !startRequestedRef.current);
        setIsWaitingForApproval(true);
        if (host && !startRequestedRef.current) {
          const deadline =
            hostApprovalDeadline ?? Date.now() + HOST_APPROVAL_TIMEOUT_MS;
          setHostApprovalDeadline(deadline);
          setHostApprovalTimeLeft(
            Math.max(
              0,
              Math.ceil(
                (deadline - Date.now()) / 1000,
              ),
            ),
          );
        } else {
          setHostApprovalDeadline(null);
          setHostApprovalTimeLeft(null);
        }

        return;
      }

      clearApprovalWait();
    };

    const onGameStarted = () => {
      startRequestedRef.current = false;
      enterGameFromLobbySnapshot();
    };

    const onJoinedRoom = (data: {
      room?: string;
      playerCount?: number;
      players?: Array<{ socketId: string; name: string }>;
    }) => {
      if (data.room && data.room !== room) return;
      if (!Array.isArray(data.players)) {
        debugLog("[Lobby] joinedRoom without players snapshot - ignored");
        return;
      }
      syncLobbyState(data.players, data.playerCount);
    };

    const onStatusUpdate = (status: "pending" | "play" | "finish") => {
      debugLog(`[Lobby] statusUpdate: ${status}`);

      if (status === "play") {
        startRequestedRef.current = false;
        enterGameFromLobbySnapshot();
        return;
      }

      if (status === "finish") {
        clearApprovalWait();
      }
    };

    const onConnect = () => {
      debugLog("[Socket] connected (lobby mode)");

      if (!joinedLobbyRef.current) {
        debugLog("[Lobby] joinRoom emit");
        joinedLobbyRef.current = true;
        joinRoomIfNeeded();
      }
    };

    const onDisconnect = (reason: string) => {
      debugLog(`[Socket] disconnected (lobby mode): ${reason}`);
      const pendingNotice = pendingDisconnectNoticeRef.current;
      const shouldSuppress = suppressDisconnectNoticeRef.current;
      pendingDisconnectNoticeRef.current = null;
      suppressDisconnectNoticeRef.current = false;
      resetLobbyState();
      if (pendingNotice) {
        onDisconnectNotice(pendingNotice);
        return;
      }
      if (!shouldSuppress) {
        onDisconnectNotice({
          title: "연결 종료",
          message: "참가 연결이 끊어졌습니다. 다시 참가해주세요.",
        });
      }
    };

    const onConnectError = (err: unknown) => {
      debugLog(`[Socket] connect_error: ${String(err)}`);
    };

    const onError = (err: unknown) => {
      debugLog(`[Socket] error: ${String(err)}`);
      startRequestedRef.current = false;
      const players = lobbyPlayersRef.current.slice(0, MAX_PLAYERS);
      const position = socket.id ? players.indexOf(socket.id) : -1;
      setCanStartGame(position === 0);
    };

    const onRoomFull = (data: { room?: string; maxPlayers?: number }) => {
      debugLog(
        `[Lobby] roomFull: ${data.room ?? room}, maxPlayers: ${
          data.maxPlayers ?? MAX_PLAYERS
        }`,
      );
      leaveLobbyWithNotice({
        title: "정원 초과",
        message: "현재 방 정원이 가득 차 참가할 수 없습니다. 다시 시도해주세요.",
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onError);
    socket.on("roomFull", onRoomFull);
    socket.on("joinedRoom", onJoinedRoom);
    socket.on("gameStarted", onGameStarted);
    socket.on("statusUpdate", onStatusUpdate);

    const timeoutId = window.setInterval(() => {
      if (!joinedLobbyRef.current || !lobbyStartAtRef.current) return;
      const elapsed = Date.now() - lobbyStartAtRef.current;
      if (elapsed >= LOBBY_TIMEOUT_MS) {
        debugLog("[Lobby] 대기 타임아웃 - 자동 이탈");
        leaveLobbyWithNotice({
          title: "시간 초과",
          message: "참가 대기 시간이 초과되어 대기열에서 나갔습니다. 다시 참가해주세요.",
        });
      }
    }, 5000);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      window.clearInterval(timeoutId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("roomFull", onRoomFull);
      socket.off("joinedRoom", onJoinedRoom);
      socket.off("gameStarted", onGameStarted);
      socket.off("statusUpdate", onStatusUpdate);
    };
  }, [
    clearApprovalWait,
    hostApprovalDeadline,
    isInGame,
    isInLobby,
    leaveLobby,
    leaveLobbyWithNotice,
    name,
    onDisconnectNotice,
    onEnterGame,
    resetLobbyState,
    room,
  ]);

  useEffect(() => {
    if (
      !isInLobby ||
      isInGame ||
      !isHost ||
      !isWaitingForApproval ||
      startRequestedRef.current ||
      hostApprovalDeadline !== null
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const deadline = Date.now() + HOST_APPROVAL_TIMEOUT_MS;
      debugLog("[Lobby] host approval deadline initialized");
      setHostApprovalDeadline(deadline);
      setHostApprovalTimeLeft(
        Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
      );
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [
    hostApprovalDeadline,
    isHost,
    isInGame,
    isInLobby,
    isWaitingForApproval,
  ]);

  useEffect(() => {
    if (
      !isInLobby ||
      isInGame ||
      !isHost ||
      !isWaitingForApproval ||
      hostApprovalDeadline === null
    ) {
      return;
    }

    const updateTimeLeft = () => {
      const timeLeft = Math.max(
        0,
        Math.ceil((hostApprovalDeadline - Date.now()) / 1000),
      );
      setHostApprovalTimeLeft(timeLeft);

      if (timeLeft <= 0) {
        debugLog("[Lobby] host approval timeout - leave room");
        leaveLobbyWithNotice({
          title: "시간 초과",
          message: "30초 안에 게임을 시작하지 않아 대기열에서 나갔습니다. 다시 참가해주세요.",
        });
      }
    };

    updateTimeLeft();
    const timerId = window.setInterval(updateTimeLeft, 250);
    return () => window.clearInterval(timerId);
  }, [
    hostApprovalDeadline,
    isHost,
    isInGame,
    isInLobby,
    isWaitingForApproval,
    leaveLobby,
    leaveLobbyWithNotice,
    onDisconnectNotice,
  ]);

  const waitingPlayers =
    lobbyPlayers?.slice(0, MAX_PLAYERS).map((socketId, index) => ({
      socketId,
      name:
        lobbyPlayerNames.get(socketId) ??
        (socketId === socket.id && name
          ? stripDisplayName(name)
          : `참가자 ${index + 1}`),
      slot: getSlotFromPosition(index),
    })) ?? [];

  const startGame = useCallback(() => {
    if (!isHost || startRequestedRef.current) return;

    const players = lobbyPlayersRef.current.slice(0, MAX_PLAYERS);
    const position = socket.id ? players.indexOf(socket.id) : -1;
    const slot = getSlotFromPosition(position);
    if (!slot || position !== 0) return;

    startRequestedRef.current = true;
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    setHostApprovalDeadline(null);
    debugLog(`[Lobby] host startGame`);
    socket.emit("startGame");
  }, [isHost]);

  return {
    isInLobby,
    lobbyPosition,
    waitingPlayers,
    isWaitingForApproval,
    isHost,
    canStartGame,
    hostApprovalTimeLeft,
    joinedLobbyRef,
    leaveLobby,
    connectAndJoinLobby,
    startGame,
  };
}
