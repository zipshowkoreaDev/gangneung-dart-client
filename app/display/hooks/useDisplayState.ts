import { useState } from "react";
import type { PlayerScore } from "@/app/display/types";

type AimState = Map<string, { x: number; y: number; skin?: string }>;

export default function useDisplayState() {
  const [aimPositions, setAimPositions] = useState<AimState>(() => new Map());
  const [players, setPlayers] = useState<Map<string, PlayerScore>>(
    () => new Map()
  );

  return {
    aimPositions,
    setAimPositions,
    players,
    setPlayers,
  };
}
