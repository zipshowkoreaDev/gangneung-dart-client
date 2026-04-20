"use client";

import { getDisplayAimBounds } from "@/lib/displayAimBounds";
import { DISPLAY_CANVAS_Y_OFFSET } from "@/lib/displayLayout";

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
  const colors = ["#ff4d4d", "#4da3ff", "#ffd54f", "#66bb6a"];
  return colors[index] ?? "#ffffff";
}

export default function AimOverlay({
  aimPositions,
  playerOrder,
  players,
}: AimOverlayProps) {
  const bounds = getDisplayAimBounds();

  return (
    <>
      {Array.from(aimPositions.entries())
        .map(([playerKey, pos]) => {
          // -1..1 → 0..1
          const x01 = (pos.x + 1) / 2;
          const y01 = (pos.y + 1) / 2 + DISPLAY_CANVAS_Y_OFFSET;
          const clampedX01 = Math.min(bounds.right, Math.max(bounds.left, x01));
          const clampedY01 = Math.min(bounds.bottom, Math.max(bounds.top, y01));

          const color = resolveColor(playerKey, playerOrder);

          return (
            <div key={playerKey}>
              {/* 조준점 원 */}
              <div
                style={{
                  position: "absolute",
                  left: `${clampedX01 * 100}%`,
                  top: `${clampedY01 * 100}%`,
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
                  left: `${clampedX01 * 100}%`,
                  top: `${clampedY01 * 100}%`,
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
                  left: `${clampedX01 * 100}%`,
                  top: `${clampedY01 * 100}%`,
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
