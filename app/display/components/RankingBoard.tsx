"use client";

import { RANKING_LIMIT, RankingEntry } from "@/lib/ranking";

interface RankingBoardProps {
  rankings: RankingEntry[];
}

export default function RankingBoard({ rankings }: RankingBoardProps) {
  const slots = Array.from(
    { length: RANKING_LIMIT },
    (_, index) => rankings[index]
  );

  return (
    <div className="absolute bottom-10 right-10 z-20 flex flex-col gap-2 shadow-md p-5 rounded-lg transition-all bg-white/20">
      <div className="text-gray-950 text-sm font-bold text-center mb-1">
        TOP {RANKING_LIMIT}
      </div>
      {slots.map((entry, index) => (
        <div
          key={entry ? `${entry.name}-${entry.timestamp}` : `empty-${index}`}
          className="flex items-center gap-2 bg-gray-50/70 backdrop-blur-sm rounded-lg border border-gray-300/60 px-3 py-2 min-w-[140px]"
        >
          <span className="font-bold text-sm w-5 text-gray-800">
            {index + 1}
          </span>
          <span className="text-gray-800 text-sm flex-1 truncate max-w-[80px] min-h-5">
            {entry?.name ?? ""}
          </span>
          <span className="text-gray-800 text-sm font-semibold min-w-4 text-right">
            {entry?.score ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
