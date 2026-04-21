import { useState } from "react";
import type { PlayerScore } from "@/app/display/components/Scoreboard";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

export default function useDisplayState() {
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());
  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);

  return {
    aimPositions,
    setAimPositions,
    players,
    setPlayers,
    playerOrder,
    setPlayerOrder,
  };
}
