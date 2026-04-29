import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FinishedPlayer } from "@/app/display/types/events";
import type { PlayerScore } from "@/app/display/types/player";
import { DISPLAY_EVENTS } from "@/lib/displayEvents";
import { socket } from "@/shared/socket";

const GAME_END_COUNTDOWN_SECONDS = 5;

type AimState = Map<string, { x: number; y: number; skin?: string }>;

type UseDisplayGameSessionProps = {
  room: string;
  setAimPositions: Dispatch<SetStateAction<AimState>>;
  setPlayers: Dispatch<SetStateAction<Map<string, PlayerScore>>>;
};

export default function useDisplayGameSession({
  room,
  setAimPositions,
  setPlayers,
}: UseDisplayGameSessionProps) {
  const [hasMatchStarted, setHasMatchStarted] = useState(false);
  const [winners, setWinners] = useState<FinishedPlayer[]>([]);
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const isShowingGameFinishedRef = useRef(false);
  const gameSessionRef = useRef(0);

  useEffect(() => {
    const clearFinishedOverlayForNewGame = () => {
      gameSessionRef.current += 1;
      isShowingGameFinishedRef.current = false;
      setWinners([]);
      setEndCountdown(null);
      setHasMatchStarted(true);
    };

    const handleDartThrow = () => {
      if (isShowingGameFinishedRef.current) {
        clearFinishedOverlayForNewGame();
        return;
      }

      setHasMatchStarted(true);
    };

    const handleGameStarted = clearFinishedOverlayForNewGame;

    const handleGameFinished = (event: Event) => {
      if (isShowingGameFinishedRef.current) return;
      isShowingGameFinishedRef.current = true;

      const detail = (event as CustomEvent).detail as {
        ranking?: FinishedPlayer[];
      };
      const topScore = detail.ranking?.[0]?.score;
      if (typeof topScore === "number") {
        setWinners(
          detail.ranking?.filter((player) => player.score === topScore) ?? []
        );
      } else {
        setWinners([]);
      }
      setEndCountdown(GAME_END_COUNTDOWN_SECONDS);
    };

    window.addEventListener(DISPLAY_EVENTS.dartThrow, handleDartThrow);
    window.addEventListener(DISPLAY_EVENTS.gameStarted, handleGameStarted);
    window.addEventListener(DISPLAY_EVENTS.gameFinished, handleGameFinished);

    return () => {
      window.removeEventListener(DISPLAY_EVENTS.dartThrow, handleDartThrow);
      window.removeEventListener(DISPLAY_EVENTS.gameStarted, handleGameStarted);
      window.removeEventListener(DISPLAY_EVENTS.gameFinished, handleGameFinished);
    };
  }, []);

  useEffect(() => {
    if (endCountdown === null) return;

    if (endCountdown <= 0) {
      const cleanupSession = gameSessionRef.current;
      const timer = window.setTimeout(() => {
        if (gameSessionRef.current !== cleanupSession) return;
        if (socket.connected) {
          socket.emit("disconnect-room", { room });
        }
        setHasMatchStarted(false);
        setWinners([]);
        setEndCountdown(null);
        isShowingGameFinishedRef.current = false;
        setPlayers(new Map());
        setAimPositions(new Map());
        window.dispatchEvent(new CustomEvent(DISPLAY_EVENTS.resetScene));
      }, 0);

      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown, room, setAimPositions, setPlayers]);

  return {
    hasMatchStarted,
    winners,
  };
}
