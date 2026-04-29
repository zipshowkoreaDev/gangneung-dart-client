"use client";

import dynamic from "next/dynamic";
import { useDisplaySocket } from "./hooks/useDisplaySocket";
import Scoreboard from "./components/Scoreboard";
import AimOverlay from "./components/AimOverlay";
import RankingBoard from "./components/RankingBoard";
import CountdownDisplay from "./components/CountdownDisplay";
import WinnerOverlay from "./components/WinnerOverlay";
import useDisplayQrUrl from "./hooks/useDisplayQrUrl";
import useRankings from "./hooks/useRankings";
import useDisplayState from "./hooks/useDisplayState";
import useDisplayGameSession from "./hooks/useDisplayGameSession";
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
  } = useDisplayState();
  const { rankings, handlePlayersFinish } = useRankings();
  const { hasMatchStarted, winners } = useDisplayGameSession({
    room: ROOM,
    setAimPositions,
    setPlayers,
  });

  const mobileUrl = useDisplayQrUrl();
  const shouldShowQr = !hasMatchStarted;

  // mobileUrl handled by useDisplayQrUrl

  useDisplaySocket({
    room: ROOM,
    setAimPositions,
    setPlayers,
    players,
    onPlayersFinish: handlePlayersFinish,
  });

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black overflow-hidden">
      <div className="relative w-full h-full aspect-9/16 max-w-[56.25vh] overflow-hidden bg-black [container-type:inline-size]">
        <Scoreboard players={players} />
        {shouldShowQr && <DisplayQRCode url={mobileUrl} />}
        <DartCanvas />
        <AimOverlay
          aimPositions={aimPositions}
          players={players}
        />
        <CountdownDisplay players={players} />
        <RankingBoard rankings={rankings} />
        <WinnerOverlay winners={winners} />
      </div>
    </div>
  );
}
