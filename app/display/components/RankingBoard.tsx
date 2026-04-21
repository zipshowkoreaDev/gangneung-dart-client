"use client";

import { RankingEntry } from "@/lib/ranking";

interface RankingBoardProps {
  rankings: RankingEntry[];
}

export default function RankingBoard({ rankings }: RankingBoardProps) {
  return (
    <div className="absolute bottom-10 right-10 z-20 flex flex-col gap-2 shadow-md p-5 rounded-lg transition-all bg-white/20" >
      <div className="text-gray-800 text-sm font-bold text-center mb-1 opacity-80">
        TOP 5
      </div>
      {rankings.length === 0 ? (
        <div className="bg-white/50 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[140px] text-center">
          <span className="text-xs">기록 없음</span>
        </div>
      ) : (
        rankings.map((entry, index) => (
          <div
            key={`${entry.name}-${entry.timestamp}`}
            className="flex items-center gap-2 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[140px]"
          >
            <span
              className={`font-bold text-sm w-5 ${
                index === 0
                  ? "text-yellow-500"
                  : index === 1
                  ? "text-gray-500"
                  : index === 2
                  ? "text-amber-500"
                  : "text-gray-900"
              }`}
            >
              {index + 1}
            </span>
            <span className="text-gray-900 text-sm flex-1 truncate max-w-[80px]">
              {entry.name}
            </span>
            <span className="text-yellow-500 text-sm font-semibold">
              {entry.score}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
