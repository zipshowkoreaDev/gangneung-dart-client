import { getDisplayAimBounds } from "@/lib/displayAimBounds";
import { DISPLAY_CANVAS_Y_OFFSET } from "@/lib/displayLayout";
import { clamp } from "@/lib/score";

type Aim = { x: number; y: number };

export function aimToDisplayPosition(aim: Aim) {
  const bounds = getDisplayAimBounds();
  const x01 = (aim.x + 1) / 2;
  const y01 = (aim.y + 1) / 2 + DISPLAY_CANVAS_Y_OFFSET;

  return {
    x01: clamp(x01, bounds.left, bounds.right),
    y01: clamp(y01, bounds.top, bounds.bottom),
  };
}

export function aimToCanvasNdc(aim: Aim) {
  const { x01, y01 } = aimToDisplayPosition(aim);
  return {
    x: x01 * 2 - 1,
    y: 1 - 2 * (y01 - DISPLAY_CANVAS_Y_OFFSET),
  };
}
