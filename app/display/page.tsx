"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useDisplaySocket } from "./hooks/useDisplaySocket";
import Scoreboard from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
import RankingBoard from "./components/RankingBoard";
import useDisplayQrUrl from "./hooks/useDisplayQrUrl";
import useRankings from "./hooks/useRankings";
import useDisplayState from "./hooks/useDisplayState";
const DisplayQRCode = dynamic(() => import("./components/DisplayQRCode"), {
  ssr: false,
});
import DartCanvas from "./components/DartCanvas";

const ROOM = process.env.NEXT_PUBLIC_ROOM ?? "zipshow";

export default function DisplayPage() {
  const [isGameActive, setIsGameActive] = useState(false);
  const [winner, setWinner] = useState<{ name: string; score: number } | null>(
    null
  );
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const {
    aimPositions,
    setAimPositions,
    players,
    setPlayers,
    playerOrder,
    setPlayerOrder,
  } = useDisplayState();
  const { rankings, handlePlayerFinish } = useRankings();

  const mobileUrl = useDisplayQrUrl();

  // mobileUrl handled by useDisplayQrUrl

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    setPlayerOrder,
    players,
    onPlayerFinish: handlePlayerFinish,
  });

  useEffect(() => {
    const handleDartThrow = () => {
      setIsGameActive(true);
    };

    const handleGameFinished = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        ranking?: Array<{ name: string; score: number }>;
      };
      const topPlayer = detail.ranking?.[0];
      if (topPlayer) {
        setWinner({ name: topPlayer.name, score: topPlayer.score });
      }
      setIsGameActive(true);
      setEndCountdown(10);
    };

    window.addEventListener("DART_THROW", handleDartThrow);
    window.addEventListener("GAME_FINISHED", handleGameFinished);
    return () => {
      window.removeEventListener("DART_THROW", handleDartThrow);
      window.removeEventListener("GAME_FINISHED", handleGameFinished);
    };
  }, []);

  useEffect(() => {
    if (endCountdown === null) return;
    if (endCountdown <= 0) {
      const timer = window.setTimeout(() => {
        setIsGameActive(false);
        setWinner(null);
        setEndCountdown(null);
        setPlayers(new Map());
        setPlayerOrder([]);
        setAimPositions(new Map());
        window.dispatchEvent(new CustomEvent("RESET_SCENE"));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(
      () => setEndCountdown((prev) => (prev === null ? null : prev - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [endCountdown, setAimPositions, setPlayerOrder, setPlayers]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-[url(/04_roulette_BG.webp)] bg-cover bg-center bg-no-repeat [container-type:inline-size]">
        <Scoreboard players={players} />
        {!isGameActive && <DisplayQRCode url={mobileUrl} />}
        <AimOverlay
          aimPositions={aimPositions}
          playerOrder={playerOrder}
          players={players}
        />
        <DartCanvas />
        <RankingBoard rankings={rankings} />
        {winner && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white text-center px-8">
            <div className="text-lg tracking-[0.3em] text-white/60 mb-4">
              WINNER
            </div>
            <div className="text-6xl font-bold text-[#FFD700] mb-4">
              {winner.name}
            </div>
            <div className="text-3xl font-semibold mb-10">
              {winner.score}점
            </div>
            {typeof endCountdown === "number" && (
              <div>
                <div className="text-sm text-white/60 mb-2">다음 게임까지</div>
                <div className="text-7xl font-bold tabular-nums">
                  {endCountdown}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
