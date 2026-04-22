import { useEffect, useMemo, useState } from "react";
import type { PlayerScore } from "@/app/display/types";
import { getTurnDelaySeconds } from "@/app/display/utils/countdown";

type TurnDelayOverlayProps = {
  players: Map<string, PlayerScore>;
};

export default function TurnDelayOverlay({ players }: TurnDelayOverlayProps) {
  const [now, setNow] = useState(() => Date.now());
  const playerList = useMemo(() => Array.from(players.values()), [players]);
  const activeDelay = playerList
    .map((player) => ({
      player,
      seconds: getTurnDelaySeconds(player, now),
    }))
    .find((item) => item.seconds > 0);

  useEffect(() => {
    if (!activeDelay) return;

    const timerId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timerId);
  }, [activeDelay]);

  if (!activeDelay) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center text-center text-white">
      <div className="flex flex-col items-center justify-center rounded-[2cqw] bg-black/55 px-[5cqw] py-[3.5cqw] shadow-2xl backdrop-blur-sm">
        <div className="mb-[1.5cqw] max-w-[44cqw] truncate text-[3cqw] font-bold leading-none text-white/90">
          {activeDelay.player.name}
        </div>
        <div className="tabular-nums text-[16cqw] font-black leading-none text-[#FFD700]">
          {activeDelay.seconds}
        </div>
        <div className="mt-[1.5cqw] text-[2.4cqw] font-bold leading-none text-white/85">
          다음 차례 준비
        </div>
      </div>
    </div>
  );
}
