import { useEffect, useMemo, useState } from "react";
import type { PlayerScore } from "@/app/display/types";
import {
  getDartTimeLeft,
  getTurnDelaySeconds,
} from "@/app/display/utils/countdown";

type CountdownDisplayProps = {
  players: Map<string, PlayerScore>;
};

export default function CountdownDisplay({ players }: CountdownDisplayProps) {
  const [now, setNow] = useState(() => Date.now());
  const playerList = useMemo(() => Array.from(players.values()), [players]);
  const activeCountdown = playerList
    .map((player) => {
      const turnDelaySeconds = getTurnDelaySeconds(player, now);
      const dartTimeLeft = getDartTimeLeft(player, now);
      return {
        seconds: turnDelaySeconds || dartTimeLeft,
        isWarning: turnDelaySeconds === 0 && dartTimeLeft <= 3,
      };
    })
    .find((item) => item.seconds > 0);

  useEffect(() => {
    if (!activeCountdown) return;

    const timerId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timerId);
  }, [activeCountdown]);

  if (!activeCountdown) return null;

  return (
    <div className="pointer-events-none absolute bottom-[4cqw] left-[4cqw] z-30 flex h-[23cqw] w-[23cqw] items-center justify-center rounded-[0.6cqw] bg-black/60 shadow-lg backdrop-blur-sm">
      <div
        className={[
          "tabular-nums text-[15cqw] font-black leading-none",
          activeCountdown.isWarning ? "text-[#ffdddd]" : "text-[#FFD700]",
        ].join(" ")}
      >
        {activeCountdown.seconds}
      </div>
    </div>
  );
}
