import type { PlayerScore } from "@/app/display/types";

type ScoreboardProps = {
  players: Map<string, PlayerScore>;
};

export default function Scoreboard({
  players,
}: ScoreboardProps) {
  const playerList = Array.from(players.values()).sort(
    (a, b) =>
      (a.slot ?? Number.MAX_SAFE_INTEGER) -
      (b.slot ?? Number.MAX_SAFE_INTEGER)
  );

  if (playerList.length === 0) return null;

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
          <span className="text-[1.5rem] font-bold">
            {player.name}
          </span>
        </div>
        <div className="text-[2rem] font-bold text-[#FFD700]">
          {hasScore ? `${player.score} 점` : ""}
        </div>
        <div className="text-[0.75rem] opacity-70">{statusText}</div>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 w-full bg-white/20 backdrop-blur-md flex gap-5 p-5 z-10 shadow-md">
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
  );
}
