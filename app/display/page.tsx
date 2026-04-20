"use client";

import dynamic from "next/dynamic";
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
  const {
    aimPositions,
    setAimPositions,
    players,
    setPlayers,
    playerOrder,
    setPlayerOrder,
    setPlayerRoomCounts,
  } = useDisplayState();
  const { rankings, handlePlayerFinish } = useRankings();

  const mobileUrl = useDisplayQrUrl();

  // mobileUrl handled by useDisplayQrUrl

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    setPlayerOrder,
    setPlayerRoomCounts,
    players,
    playerOrder,
    onPlayerFinish: handlePlayerFinish,
  });

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-[url(/04_roulette_BG.webp)] bg-cover bg-center bg-no-repeat">
        <Scoreboard players={players} />
        <DisplayQRCode url={mobileUrl} />
        <AimOverlay
          aimPositions={aimPositions}
          playerOrder={playerOrder}
          players={players}
        />
        <DartCanvas />
        <RankingBoard rankings={rankings} />
      </div>
    </div>
  );
}
