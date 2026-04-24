import {
  getHitScoreFromAim as getHitScoreFromAimBase,
  DEFAULT_ROULETTE_RADIUS,
} from "@/lib/score";
import { getRouletteCenter, getRouletteRadius } from "@/app/display/three/scoreMeasurement";

export function getCurrentRouletteRadius(): number {
  const radius = getRouletteRadius();
  if (Number.isFinite(radius) && radius > 0) {
    return radius;
  }
  return DEFAULT_ROULETTE_RADIUS;
}

export function getHitScoreFromAim(aim?: { x: number; y: number }): number {
  return getHitScoreFromAimBase(
    aim,
    getCurrentRouletteRadius(),
    getRouletteCenter(),
  );
}
