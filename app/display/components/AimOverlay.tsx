"use client";

import { aimToDisplayPosition } from "@/lib/displayAimCoordinates";
import { getPlayerColor } from "@/app/display/utils/playerColors";

type AimPosition = {
  x: number;
  y: number;
  skin?: string;
};

type AimOverlayProps = {
  aimPositions: Map<string, AimPosition>;
  playerOrder: string[];
  players: Map<string, { isReady: boolean; name?: string }>;
};

function resolveColor(playerKey: string, playerOrder: string[]) {
  const index = playerOrder.indexOf(playerKey);
  return getPlayerColor(index);
}

export default function AimOverlay({
  aimPositions,
  playerOrder,
  players,
}: AimOverlayProps) {
  return (
    <>
      {Array.from(aimPositions.entries())
        .map(([playerKey, pos]) => {
          const { x01, y01 } = aimToDisplayPosition(pos);
          const color = resolveColor(playerKey, playerOrder);

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
              {/* 플레이어 이름 */}
              <div
                style={{
                  position: "absolute",
                  left: `${x01 * 100}%`,
                  top: `${y01 * 100}%`,
                  transform: "translate(-50%, calc(-50% - 35px))",
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  zIndex: 7,
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {players.get(playerKey)?.name ?? playerKey}
              </div>
            </div>
          );
        })}
    </>
  );
}
