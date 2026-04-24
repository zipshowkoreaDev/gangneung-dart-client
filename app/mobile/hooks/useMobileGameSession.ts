import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ControllerGameResult, ScoreEntry } from "@/app/mobile/types/game";

const GAME_END_COUNTDOWN_SECONDS = 5;

type UseMobileGameSessionParams = {
  isInGame: boolean;
  gamePlayers: string[];
};

export default function useMobileGameSession({
  isInGame,
  gamePlayers,
}: UseMobileGameSessionParams) {
  const [finishedPlayers, setFinishedPlayers] = useState<Set<string>>(
    () => new Set(),
  );
  const [playerScores, setPlayerScores] = useState<Map<string, ScoreEntry>>(
    () => new Map(),
  );
  const [gameResult, setGameResult] =
    useState<ControllerGameResult | null>(null);
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const [serverGameFinished, setServerGameFinished] = useState(false);
  const previousInGameRef = useRef(false);

  const resetRoundState = useCallback(() => {
    setFinishedPlayers(new Set());
    setPlayerScores(new Map());
    setGameResult(null);
    setEndCountdown(null);
    setServerGameFinished(false);
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

  const handleSocketGameFinished = useCallback(() => {
    setServerGameFinished(true);
  }, []);

  const gameFinished = useMemo(
    () =>
      isInGame &&
      (serverGameFinished ||
        (gamePlayers.length > 0 &&
          gamePlayers.every((playerId) => finishedPlayers.has(playerId)))),
    [finishedPlayers, gamePlayers, isInGame, serverGameFinished],
  );

  useEffect(() => {
    let timer: number | undefined;

    if (isInGame && !previousInGameRef.current) {
      timer = window.setTimeout(() => {
        resetRoundState();
      }, 0);
    }

    previousInGameRef.current = isInGame;
    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [isInGame, resetRoundState]);

  useEffect(() => {
    if (!gameFinished || endCountdown !== null) return;

    const timer = window.setTimeout(
      () => setEndCountdown(GAME_END_COUNTDOWN_SECONDS),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [gameFinished, endCountdown]);

  useEffect(() => {
    if (endCountdown === null || endCountdown <= 0) return;

    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown]);

  return {
    endCountdown,
    finishedPlayers,
    gameFinished,
    gameResult,
    handlePlayerFinished,
    handlePlayerScored,
    handleSocketGameFinished,
    playerScores,
    resetRoundState,
    setGameResult,
  };
}
