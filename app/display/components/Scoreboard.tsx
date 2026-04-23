import type { PlayerScore } from "@/app/display/types";
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

  const renderThrowScores = (player: PlayerScore) => {
    const scores = Array.from({ length: 3 }, (_, index) => ({
      label: index === 0 ? "1st" : index === 1 ? "2nd" : "3rd",
      score: player.throwScores?.[index],
    }));

    return (
      <div className="flex items-center justify-center gap-3 text-[1.25rem] font-semibold leading-none text-[#FFD700]/85">
        {scores.map((item) => (
          <div key={item.label} className="flex items-baseline gap-1">
            <span className="text-[#FFD700]/55">{item.label}</span>
            <span>{item.score ?? "-"}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderPlayerCard = (player: PlayerScore) => {
    const hasPlayed = player.totalThrows >= 3;
    const hasScore = !player.isWaiting && player.totalThrows > 0;
    const remainingThrows = Math.max(0, 3 - player.totalThrows);
    const statusText = player.isWaiting
      ? "입장 대기 중"
      : hasPlayed
        ? "플레이 완료"
        : `남은 기회: ${remainingThrows}`;

    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg transition-all"
        style={{
          background: player.isWaiting
            ? "rgba(255, 255, 255, 0.12)"
            : player?.isReady
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.05)",
          opacity: 1,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[1.5rem] font-bold">{player.name}</span>
        </div>

        {renderThrowScores(player)}

        <div className="text-[2rem] font-bold text-[#FFD700]">
          {hasScore ? `${player.score} 점` : ""}
        </div>
        <div className="text-[0.75rem] opacity-70">{statusText}</div>
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
        {playerList.map((player) => (
          <div
            key={
              player.slot ? `slot-${player.slot}` : player.socketId || player.name
            }
            className="flex-1 bg-white/40 rounded-lg"
          >
            {renderPlayerCard(player)}
          </div>
        ))}
      </div>
    </div>
  );
}
