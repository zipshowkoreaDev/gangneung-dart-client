"use client";

import { MAX_PLAYERS } from "@/lib/room";
import type { PlayerSlot } from "@/lib/room";

type PlayerScore = {
  socketId?: string;
  slot?: PlayerSlot;
  name: string;
  score: number;
  isConnected: boolean;
  isReady: boolean;
  totalThrows: number;
  currentThrows: number;
};

type ScoreboardProps = {
  players: Map<string, PlayerScore>;
};

export default function Scoreboard({
  players,
}: ScoreboardProps) {
  const playerList = Array.from(players.values());
  const slots = Array.from({ length: MAX_PLAYERS }, (_, index) => {
    const slot = (index + 1) as PlayerSlot;
    return playerList.find((player) => player.slot === slot);
  });

  const renderPlayerCard = (player: PlayerScore | undefined, index: number) => {
    const hasPlayed = player ? player.totalThrows >= 3 : false;
    const remainingThrows = player ? Math.max(0, 3 - player.totalThrows) : 0;
    const statusText = !player
      ? "대기 중"
      : hasPlayed
      ? "플레이 완료"
      : `남은 기회: ${remainingThrows}`;

    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg transition-all"
        style={{
          background: player?.isReady
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(255, 255, 255, 0.05)",
          opacity: player ? 1 : 0.45,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[1.5rem] font-bold">
            {player?.name ?? `PLAYER ${index + 1}`}
          </span>
        </div>
        <div className="text-[2rem] font-bold text-[#FFD700]">
          {player && hasPlayed ? `${player.score} 점` : ""}
        </div>
        <div className="text-[0.75rem] opacity-70">{statusText}</div>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 w-full bg-white/20 backdrop-blur-md flex gap-5 p-5 z-10 shadow-md">
      {slots.map((player, index) => (
        <div
          key={player?.socketId || player?.name || `slot-${index}`}
          className="flex-1 bg-white/40 rounded-lg"
        >
          {renderPlayerCard(player, index)}
        </div>
      ))}
    </div>
  );
}

export type { PlayerScore };
