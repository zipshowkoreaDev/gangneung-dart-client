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
    <div className="absolute bottom-[4cqw] right-[4cqw] z-20 flex w-[34cqw] flex-col gap-[1cqw] rounded-[1.5cqw] bg-white/20 p-[2cqw] shadow-md transition-all">
      <div className="mb-[0.5cqw] text-center text-[3cqw] font-bold leading-none text-gray-950">
        TOP {RANKING_LIMIT}
      </div>
      {slots.map((entry, index) => (
        <div
          key={entry ? `${entry.name}-${entry.timestamp}` : `empty-${index}`}
          className="flex items-center gap-[1cqw] rounded-[1.3cqw] border border-gray-300/60 bg-gray-50/70 px-[1.8cqw] py-[0.9cqw] backdrop-blur-sm"
        >
          <span className="pr-[0.5cqw] text-[2.5cqw] font-bold leading-none text-gray-800">
            {index + 1}.
          </span>
          <span className="min-h-[3.45cqw] flex-1 truncate text-[2.25cqw] leading-none text-gray-800">
            {entry?.name ?? ""}
          </span>
          <span className="text-right text-[2.5cqw] font-semibold leading-none text-gray-800">
            {entry?.score ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
