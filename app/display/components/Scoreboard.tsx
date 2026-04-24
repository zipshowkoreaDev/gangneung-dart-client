import type { PlayerScore } from "@/app/display/types/player";
import { getPlayerColor } from "@/app/display/lib/playerColors";
import { MAX_PLAYERS, type PlayerSlot } from "@/lib/room";

type ScoreboardProps = {
  players: Map<string, PlayerScore>;
};

export default function Scoreboard({ players }: ScoreboardProps) {
  const sortedPlayers = Array.from(players.values()).sort(
    (a, b) =>
      (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER),
  );
  const hasGameStarted = sortedPlayers.some(
    (player) => !player.isWaiting && (player.isReady || player.totalThrows > 0),
  );
  const playersBySlot = new Map(
    sortedPlayers
      .filter((player): player is PlayerScore & { slot: PlayerSlot } => Boolean(player.slot))
      .map((player) => [player.slot, player]),
  );

  const renderThrowDots = (player: PlayerScore) => {
    const color = player.slot ? getPlayerColor(player.slot - 1) : "#ffffff";
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

  const renderEmptyCard = (slot: PlayerSlot) => {
    const color = getPlayerColor(slot - 1);

    return (
      <div
        className="flex h-[clamp(6.8rem,15cqw,8.5rem)] flex-1 flex-col justify-between gap-3 rounded-lg border border-white/15 bg-white/5 p-[clamp(0.8rem,2.6cqw,1.25rem)] transition-all"
        style={{ boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        <div className="flex min-w-0 items-center justify-between gap-4">
          <span
            className={[
              "min-w-0 flex-1 truncate text-left text-[clamp(0.95rem,3cqw,1.5rem)] font-bold leading-none text-white/35 transition-opacity",
              hasGameStarted ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            PLAYER {slot}
          </span>
          <div className="flex shrink-0 items-center gap-[0.55rem]" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={index}
                className="block h-[clamp(0.55rem,2cqw,0.85rem)] w-[clamp(0.55rem,2cqw,0.85rem)] rounded-full border border-white/15 bg-white/8"
              />
            ))}
          </div>
        </div>

        <div className="flex min-h-[clamp(1.45rem,4cqw,2rem)] items-center justify-between gap-[clamp(0.45rem,2cqw,1rem)] text-[clamp(1.05rem,3.6cqw,2rem)] font-bold leading-none text-white/20">
          <div className="flex min-w-0 items-center gap-[clamp(0.35rem,1.5cqw,0.75rem)] text-left" />
          <div
            className={[
              "shrink-0 text-right text-white/20 transition-opacity",
              hasGameStarted ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            READY
          </div>
        </div>
      </div>
    );
  };

  const renderPlayerCard = (player: PlayerScore) => {
    const throwScores = player.throwScores ?? [];

    return (
      <div
        className="flex h-[clamp(6.8rem,15cqw,8.5rem)] flex-1 flex-col justify-between gap-3 rounded-lg p-[clamp(0.8rem,2.6cqw,1.25rem)] transition-all"
        style={{
          background: player.isWaiting
            ? "rgba(255, 255, 255, 0.12)"
            : player.isReady
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.05)",
          opacity: 1,
        }}
      >
        <div className="flex min-w-0 items-center justify-between gap-4">
          <span className="min-w-0 flex-1 truncate text-left text-[clamp(1.1rem,3.4cqw,1.75rem)] font-bold leading-none">
            {player.name}
          </span>
          {renderThrowDots(player)}
        </div>

        <div className="flex min-h-[clamp(1.45rem,4cqw,2rem)] items-center justify-between gap-[clamp(0.45rem,2cqw,1rem)] font-bold leading-none text-[#FFD700]">
          <div className="flex min-w-0 items-center gap-[clamp(0.25rem,1.1cqw,0.55rem)] text-left text-[clamp(0.9rem,2.8cqw,1.45rem)]">
            {throwScores.map((score, index) => (
              <span key={`${index}-${score}`} className="shrink-0">
                {score}
              </span>
            ))}
          </div>
          <div className="shrink-0 text-right text-[clamp(1rem,3.1cqw,1.75rem)]">
            {throwScores.length > 0 ? `${player.score}점` : "READY"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 z-10 w-full bg-white/20 py-7.5 px-5 shadow-md backdrop-blur-md">
      <div className="flex gap-7.5">
        {Array.from({ length: MAX_PLAYERS }, (_, index) => {
          const slot = (index + 1) as PlayerSlot;
          const player = playersBySlot.get(slot);

          return (
            <div key={`slot-${slot}`} className="flex-1 rounded-lg bg-white/40">
              {player ? renderPlayerCard(player) : renderEmptyCard(slot)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
