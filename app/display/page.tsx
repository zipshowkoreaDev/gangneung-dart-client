"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useDisplaySocket } from "./hooks/useDisplaySocket";
import Scoreboard from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
import RankingBoard from "./components/RankingBoard";
import CountdownDisplay from "./components/CountdownDisplay";
import useDisplayQrUrl from "./hooks/useDisplayQrUrl";
import useRankings from "./hooks/useRankings";
import useDisplayState from "./hooks/useDisplayState";
const DisplayQRCode = dynamic(() => import("./components/DisplayQRCode"), {
  ssr: false,
});
import DartCanvas from "./components/DartCanvas";

const ROOM = process.env.NEXT_PUBLIC_ROOM ?? "zipshow";
const GAME_END_COUNTDOWN_SECONDS = 5;

type FinishedPlayer = {
  name: string;
  score: number;
};

export default function DisplayPage() {
  const [isGameActive, setIsGameActive] = useState(false);
  const [winners, setWinners] = useState<FinishedPlayer[]>([]);
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const isShowingGameFinishedRef = useRef(false);
  const gameSessionRef = useRef(0);
  const {
    aimPositions,
    setAimPositions,
    players,
    setPlayers,
  } = useDisplayState();
  const { rankings, handlePlayersFinish } = useRankings();

  const mobileUrl = useDisplayQrUrl();

  // mobileUrl handled by useDisplayQrUrl

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    players,
    onPlayersFinish: handlePlayersFinish,
  });

  useEffect(() => {
    const clearFinishedOverlayForNewGame = () => {
      gameSessionRef.current += 1;
      isShowingGameFinishedRef.current = false;
      setWinners([]);
      setEndCountdown(null);
      setIsGameActive(true);
    };
    const handleDartThrow = () => {
      if (isShowingGameFinishedRef.current) {
        clearFinishedOverlayForNewGame();
        return;
      }

      setIsGameActive(true);
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
          detail.ranking?.filter((player) => player.score === topScore) ?? [],
        );
      } else {
        setWinners([]);
      }
      setIsGameActive(true);
      setEndCountdown(GAME_END_COUNTDOWN_SECONDS);
    };

    window.addEventListener("DART_THROW", handleDartThrow);
    window.addEventListener("GAME_STARTED", handleGameStarted);
    window.addEventListener("GAME_FINISHED", handleGameFinished);
    return () => {
      window.removeEventListener("DART_THROW", handleDartThrow);
      window.removeEventListener("GAME_STARTED", handleGameStarted);
      window.removeEventListener("GAME_FINISHED", handleGameFinished);
    };
  }, []);

  useEffect(() => {
    if (endCountdown === null) return;
    if (endCountdown <= 0) {
      const cleanupSession = gameSessionRef.current;
      const timer = window.setTimeout(() => {
        if (gameSessionRef.current !== cleanupSession) return;
        setIsGameActive(false);
        setWinners([]);
        setEndCountdown(null);
        isShowingGameFinishedRef.current = false;
        setPlayers(new Map());
        setAimPositions(new Map());
        window.dispatchEvent(new CustomEvent("RESET_SCENE"));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown, setAimPositions, setPlayers]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-black [container-type:inline-size]">
        <Scoreboard players={players} />
        {!isGameActive && <DisplayQRCode url={mobileUrl} />}
        <DartCanvas />
        <AimOverlay
          aimPositions={aimPositions}
          players={players}
        />
        <CountdownDisplay players={players} />
        <RankingBoard rankings={rankings} />
        {winners.length > 0 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white text-center px-8">
            <div className="text-lg tracking-[0.3em] text-white/60 mb-4">
              {winners.length > 1 ? "WINNERS" : "WINNER"}
            </div>
            <div className="mb-4 flex max-w-full flex-col items-center gap-3">
              {winners.map((winner, index) => (
                <div
                  key={`${winner.name}-${winner.score}-${index}`}
                  className="max-w-full truncate text-6xl font-bold text-[#FFD700]"
                >
                  {winner.name}
                </div>
              ))}
            </div>
            <div className="text-3xl font-semibold mb-10">
              {winners[0]?.score}점
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
