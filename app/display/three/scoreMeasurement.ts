export const SCORE_MEASUREMENT_CENTER: [number, number, number] = [0, 2, 0];

let cachedRouletteRadius = 20;

export function setRouletteRadius(radius: number) {
  if (Number.isFinite(radius) && radius > 0) {
    cachedRouletteRadius = radius;
  }
}

export function getRouletteRadius(): number {
  return cachedRouletteRadius;
}

export function getRouletteCenter(): { x: number; y: number } {
  return {
    x: SCORE_MEASUREMENT_CENTER[0],
    y: SCORE_MEASUREMENT_CENTER[1],
  };
}
