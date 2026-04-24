import { useEffect, useMemo, useState } from "react";
import type { PlayerScore } from "@/app/display/types/player";
import { getActiveCountdown } from "@/app/display/lib/countdown";

type CountdownDisplayProps = {
  players: Map<string, PlayerScore>;
};

export default function CountdownDisplay({ players }: CountdownDisplayProps) {
  const [now, setNow] = useState(() => Date.now());
  const activeCountdown = useMemo(
    () => getActiveCountdown(players.values(), now),
    [players, now]
  );

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
