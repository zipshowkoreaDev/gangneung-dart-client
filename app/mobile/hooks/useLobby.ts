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
  const lastRejoinAtRef = useRef(0);
  const lobbyStartAtRef = useRef<number | null>(null);
  const lastJoinedSocketIdRef = useRef<string | null>(null);
  const startRequestedRef = useRef(false);
  const lobbyPlayersRef = useRef<string[]>([]);
  const lobbyOrderRef = useRef<string[]>([]);
  const joinedRoomRef = useRef(false);

  const clearApprovalWait = useCallback(() => {
    setIsWaitingForApproval(false);
    setIsHost(false);
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    setHostApprovalDeadline(null);
  }, []);

  const leaveLobby = useCallback(() => {
    if (socket.connected) {
      debugLog("[Lobby] socket disconnect");
      socket.disconnect();
    }
    joinedRoomRef.current = false;
    joinedLobbyRef.current = false;
    setIsInLobby(false);
    setLobbyPosition(null);
    setLobbyPlayers(null);
    setLobbyPlayerNames(new Map());
    lobbyPlayersRef.current = [];
    lobbyOrderRef.current = [];
    setIsHost(false);
    setCanStartGame(false);
    setHostApprovalTimeLeft(null);
    lobbyStartAtRef.current = null;
    startRequestedRef.current = false;
    clearApprovalWait();
  }, [clearApprovalWait]);

  const connectAndJoinLobby = useCallback(() => {
    if (socket.connected) {
      debugLog("[Lobby] 기존 소켓 연결 해제 후 재연결");
      socket.disconnect();
      joinedLobbyRef.current = false;
      joinedRoomRef.current = false;
      lastJoinedSocketIdRef.current = null;
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
    ) => {
      const incomingSocketIds = Array.from(
        new Set(
          (players ?? [])
            .map((player) => player.socketId)
            .filter((socketId): socketId is string => Boolean(socketId)),
        ),
      );
      const incomingSocketIdSet = new Set(incomingSocketIds);
      const preservedOrder = lobbyOrderRef.current.filter((socketId) =>
        incomingSocketIdSet.has(socketId),
      );
      const appendedOrder = incomingSocketIds.filter(
        (socketId) => !preservedOrder.includes(socketId),
      );
      const lobbySocketIds = [...preservedOrder, ...appendedOrder].slice(
        0,
        MAX_PLAYERS,
      );
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
          if (!currentSocketIds.has(socketId)) {
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
        const now = Date.now();
        if (now - lastRejoinAtRef.current > 5000) {
          lastRejoinAtRef.current = now;
          debugLog("[Lobby] 내 소켓이 방에 없음 - 재입장 시도");
          joinedRoomRef.current = false;
          joinRoomIfNeeded();
          joinedLobbyRef.current = true;
          if (socket.id) {
            lastJoinedSocketIdRef.current = socket.id;
          }
        }
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
      syncLobbyState(data.players);
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

      if (!joinedLobbyRef.current || lastJoinedSocketIdRef.current !== socket.id) {
        debugLog("[Lobby] joinRoom emit");
        joinedLobbyRef.current = true;
        if (socket.id) {
          lastJoinedSocketIdRef.current = socket.id;
        }
        joinRoomIfNeeded();
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
      leaveLobby();
    };

    socket.on("connect", onConnect);
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
        leaveLobby();
      }
    }, 5000);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      window.clearInterval(timeoutId);
      socket.off("connect", onConnect);
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
    name,
    onEnterGame,
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
        leaveLobby();
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
