"use client";

import { aimToDisplayPosition } from "@/lib/displayAimCoordinates";
import { getPlayerColor } from "@/app/display/lib/playerColors";
import type { PlayerSlot } from "@/lib/room";

type AimPosition = {
  x: number;
  y: number;
  skin?: string;
};

type AimOverlayProps = {
  aimPositions: Map<string, AimPosition>;
  players: Map<string, { isReady: boolean; slot?: PlayerSlot }>;
};

function getSlotFromPlayerKey(playerKey: string) {
  const slotMatch = playerKey.match(/^slot-([1-4])$/);
  if (!slotMatch) return undefined;
  return Number(slotMatch[1]) as PlayerSlot;
}

function resolveColor(
  playerKey: string,
  players: Map<string, { isReady: boolean; slot?: PlayerSlot }>
) {
  const slot = players.get(playerKey)?.slot ?? getSlotFromPlayerKey(playerKey);
  if (slot) {
    return getPlayerColor(slot - 1);
  }
  return "#ffffff";
}

export default function AimOverlay({
  aimPositions,
  players,
}: AimOverlayProps) {
  return (
    <>
      {Array.from(aimPositions.entries())
        .map(([playerKey, pos]) => {
          const { x01, y01 } = aimToDisplayPosition(pos);
          const color = resolveColor(playerKey, players);

          return (
            <div key={playerKey}>
              {/* 조준점 원 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `4px solid ${color}`,
                  background: `${color}33`,
                  zIndex: 5,
                  pointerEvents: "none",
                  transition: "all 0.05s ease-out",
                }}
              />
              {/* 중심점 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              />
            </div>
          );
        })}
    </>
  );
}
