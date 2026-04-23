import type { PlayerScore } from "@/app/display/types";
import { getPlayerColor } from "@/app/display/utils/playerColors";
import { MAX_PLAYERS } from "@/lib/room";

type ScoreboardProps = {
  players: Map<string, PlayerScore>;
};

export default function Scoreboard({ players }: ScoreboardProps) {
  const playerList = Array.from(players.values()).sort(
    (a, b) =>
      (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER),
  );

  if (playerList.length === 0) return null;

  const renderThrowDots = (player: PlayerScore, playerIndex: number) => {
    const color = getPlayerColor(playerIndex);
    const remainingThrows = Math.max(0, 3 - player.totalThrows);

    return (
      <div
        className="flex shrink-0 items-center gap-[0.55rem]"
        aria-label={`남은 투척 횟수 ${remainingThrows}/3`}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <span
            key={index}
            className="block h-[clamp(0.55rem,2cqw,0.85rem)] w-[clamp(0.55rem,2cqw,0.85rem)] rounded-full border"
            style={{
              backgroundColor:
                index < remainingThrows ? color : "rgba(255, 255, 255, 0.14)",
              borderColor:
                index < remainingThrows ? color : "rgba(255, 255, 255, 0.35)",
              boxShadow:
                index < remainingThrows ? `0 0 10px ${color}99` : "none",
            }}
          />
        ))}
      </div>
    );
  };

  const renderPlayerCard = (player: PlayerScore, playerIndex: number) => {
    const throwScores = player.throwScores ?? [];

    return (
      <div
        className="flex h-[clamp(6.8rem,15cqw,8.5rem)] flex-1 flex-col justify-between gap-3 rounded-lg p-[clamp(0.8rem,2.6cqw,1.25rem)] transition-all"
        style={{
          background: player.isWaiting
            ? "rgba(255, 255, 255, 0.12)"
            : player?.isReady
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.05)",
          opacity: 1,
        }}
      >
        <div className="flex min-w-0 items-center justify-between gap-4">
          <span className="min-w-0 flex-1 truncate text-left text-[clamp(0.95rem,3cqw,1.5rem)] font-bold leading-none">
            {player.name}
          </span>
          {renderThrowDots(player, playerIndex)}
        </div>

        <div className="flex min-h-[clamp(1.45rem,4cqw,2rem)] items-center justify-between gap-[clamp(0.45rem,2cqw,1rem)] text-[clamp(1.05rem,3.6cqw,2rem)] font-bold leading-none text-[#FFD700]">
          <div className="flex min-w-0 items-center gap-[clamp(0.35rem,1.5cqw,0.75rem)] text-left">
            {throwScores.map((score, index) => (
              <span key={`${index}-${score}`} className="shrink-0">
                {score}
              </span>
            ))}
          </div>
          <div className="shrink-0 text-right">
            {throwScores.length > 0 ? `${player.score}점` : ""}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 z-10 w-full bg-white/20 p-5 shadow-md backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between text-white">
        <div className="text-[1rem] font-semibold opacity-80">참가자</div>
        <div className="rounded-md bg-black/35 px-3 py-1 text-[0.9rem] font-bold tabular-nums">
          {playerList.length}/{MAX_PLAYERS}
        </div>
      </div>
      <div className="flex gap-5">
        {playerList.map((player, index) => (
          <div
            key={
              player.slot ? `slot-${player.slot}` : player.socketId || player.name
            }
            className="flex-1 bg-white/40 rounded-lg"
          >
            {renderPlayerCard(player, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
