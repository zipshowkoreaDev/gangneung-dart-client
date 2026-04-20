"use client";

import { MAX_PLAYERS } from "@/lib/room";

type PlayerScore = {
  socketId?: string;
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
  const slots = Array.from({ length: MAX_PLAYERS }, (_, index) => playerList[index]);

  const renderPlayerCard = (player: PlayerScore | undefined) => {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg transition-all"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[1.5rem] font-bold">{player?.name}</span>
        </div>
        <div className="text-[2rem] font-bold text-[#FFD700]">
          {player?.score ? `${player?.score} 점` : ""}
        </div>
        <div className="text-[0.75rem] opacity-70">
          {player ? `남은 기회: ${Math.max(0, 3 - player.totalThrows)}` : ""}
        </div>
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
          {renderPlayerCard(player)}
        </div>
      ))}
    </div>
  );
}

export type { PlayerScore };
