import { DISPLAY_CANVAS_Y_OFFSET } from "@/lib/displayLayout";
import { clamp } from "@/lib/score";

type Aim = { x: number; y: number };

export function aimToDisplayPosition(aim: Aim) {
  const x01 = (aim.x + 1) / 2;
  const y01 = (aim.y + 1) / 2 + DISPLAY_CANVAS_Y_OFFSET;

  return {
    x01: clamp(x01, 0, 1),
    y01: clamp(y01, 0, 1),
  };
}

export function aimToCanvasNdc(aim: Aim) {
  const { x01, y01 } = aimToDisplayPosition(aim);
  return {
    x: x01 * 2 - 1,
    y: 1 - 2 * (y01 - DISPLAY_CANVAS_Y_OFFSET),
  };
}
