import { clamp } from "@/lib/score";
import { DISPLAY_CANVAS_Y_OFFSET } from "@/lib/displayLayout";

export const DISPLAY_AIM_BOUNDS = {
  centerX: 0.5,
  centerY: 0.35,
  height: 0.45,
  aspect: 1,
} as const;

export function getDisplayAimBounds() {
  const width = DISPLAY_AIM_BOUNDS.height * DISPLAY_AIM_BOUNDS.aspect;
  const halfW = width / 2;
  const halfH = DISPLAY_AIM_BOUNDS.height / 2;
  return {
    left: DISPLAY_AIM_BOUNDS.centerX - halfW,
    right: DISPLAY_AIM_BOUNDS.centerX + halfW,
    top: DISPLAY_AIM_BOUNDS.centerY - halfH,
    bottom: DISPLAY_AIM_BOUNDS.centerY + halfH,
    width,
    height: DISPLAY_AIM_BOUNDS.height,
  };
}

export function isAimInsideDisplayBounds(aim?: { x: number; y: number }): boolean {
  if (!aim) return false;
  const bounds = getDisplayAimBounds();
  const x = clamp(aim.x, -1, 1);
  const y = clamp(aim.y, -1, 1);
  const x01 = (x + 1) / 2;
  const y01 = (y + 1) / 2 + DISPLAY_CANVAS_Y_OFFSET;
  return (
    x01 >= bounds.left &&
    x01 <= bounds.right &&
    y01 >= bounds.top &&
    y01 <= bounds.bottom
  );
}
