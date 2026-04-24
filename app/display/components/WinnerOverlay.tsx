"use client";

import type { FinishedPlayer } from "@/app/display/types/events";

type WinnerOverlayProps = {
  winners: FinishedPlayer[];
};

export default function WinnerOverlay({ winners }: WinnerOverlayProps) {
  if (winners.length === 0) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-8 text-center text-white">
      <div className="mb-4 text-lg tracking-[0.3em] text-white/60">
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
      <div className="mb-10 text-3xl font-semibold">{winners[0]?.score}점</div>
    </div>
  );
}
