"use client";

import { RANKING_LIMIT, RankingEntry } from "@/lib/ranking";
import { formatDuplicateDisplayNames } from "@/lib/displayName";

interface RankingBoardProps {
  rankings: RankingEntry[];
}

const BOARD_BORDER_WIDTH = "0.25cqw";
const BOARD_BORDER_COLOR = "rgba(255, 255, 255, 0.5)";
const BOARD_BOX_SHADOW =
  "0 0 0 1px rgba(255,255,255,0.16) inset, 0 12px 24px rgba(15,23,42,0.22)";

const RANK_STYLES = [
  {
    cardClass:
      "border-[#f6dc7a]/80 bg-[linear-gradient(135deg,rgba(250,214,83,0.95)_0%,rgba(188,131,22,0.92)_100%)]",
    rankClass: "text-[#5f3b00]",
    nameClass: "text-[#4a2e00]",
    scoreClass: "text-[#4a2e00]",
    shadow: "0 0 0 1px rgba(255,229,138,0.42) inset",
  },
  {
    cardClass:
      "border-[#d8dee8]/85 bg-[linear-gradient(135deg,rgba(233,239,247,0.96)_0%,rgba(157,166,180,0.92)_100%)]",
    rankClass: "text-[#4b5563]",
    nameClass: "text-[#374151]",
    scoreClass: "text-[#374151]",
    shadow: "0 0 0 1px rgba(255,255,255,0.35) inset",
  },
  {
    cardClass:
      "border-[#d8a377]/85 bg-[linear-gradient(135deg,rgba(244,191,144,0.96)_0%,rgba(151,93,53,0.92)_100%)]",
    rankClass: "text-[#5f3417]",
    nameClass: "text-[#4a2812]",
    scoreClass: "text-[#4a2812]",
    shadow: "0 0 0 1px rgba(255,230,211,0.24) inset",
  },
] as const;

export default function RankingBoard({ rankings }: RankingBoardProps) {
  const slots = Array.from(
    { length: RANKING_LIMIT },
    (_, index) => rankings[index]
  );
  const filledEntries = slots.filter((entry): entry is RankingEntry => Boolean(entry));
  const displayNames = formatDuplicateDisplayNames(filledEntries, (entry) => entry.name);
  const displayNameByEntry = new Map(
    filledEntries.map((entry, index) => [entry, displayNames[index]] as const),
  );

  return (
    <div
      className="absolute bottom-[4cqw] right-[4cqw] z-20 flex w-[34cqw] flex-col gap-[1cqw] rounded-[1.5cqw] border bg-[linear-gradient(180deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.16)_100%)] p-[2cqw] shadow-md backdrop-blur-md transition-all"
      style={{
        borderColor: BOARD_BORDER_COLOR,
        borderWidth: BOARD_BORDER_WIDTH,
        boxShadow: BOARD_BOX_SHADOW,
      }}
    >
      <div className="mb-[1cqw] text-center text-[3cqw] font-black leading-none text-white">
        TOP {RANKING_LIMIT}
      </div>
      {slots.map((entry, index) => {
        const style = RANK_STYLES[index];
        const displayName = entry ? displayNameByEntry.get(entry) ?? "" : "";

        return (
          <div
            key={entry ? `${entry.name}-${entry.timestamp}` : `empty-${index}`}
            className={`flex items-center gap-[1cqw] rounded-[1.3cqw] border px-[1.8cqw] py-[0.9cqw] backdrop-blur-sm ${style.cardClass}`}
            style={{ boxShadow: style.shadow }}
          >
            <span className={`pr-[0.5cqw] text-[2.5cqw] font-black leading-none ${style.rankClass}`}>
              {index + 1}.
            </span>
            <span
              className={`flex min-h-[3.45cqw] flex-1 items-center truncate text-[2.25cqw] font-semibold leading-none ${style.nameClass}`}
            >
              {displayName}
            </span>
            <span
              className={`text-right text-[2.5cqw] font-black leading-none ${style.scoreClass}`}
            >
              {entry ? `${entry.score} PTS` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
