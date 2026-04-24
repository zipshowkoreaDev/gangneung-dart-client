import { BULL_SCORES, DEFAULT_ROULETTE_RADIUS } from "@/lib/dartboardConfig";
import {
  getAimPositionAndDistance,
  getSectorValueFromAim,
  getZoneFromRatio,
} from "@/lib/dartboardMath";

export type Zone =
  | "INNER_BULL"
  | "OUTER_BULL"
  | "TRIPLE"
  | "DOUBLE"
  | "SINGLE"
  | "MISS";
export type Point2D = { x: number; y: number };

const DEFAULT_ROULETTE_CENTER: Point2D = { x: 0, y: 0 };

export function getScoreFromZone(zone: Zone, sectorValue = 0): number {
  if (zone === "INNER_BULL" || zone === "OUTER_BULL" || zone === "MISS") {
    return BULL_SCORES[zone];
  }
  if (zone === "SINGLE") return sectorValue;
  if (zone === "DOUBLE") return sectorValue * 2;
  if (zone === "TRIPLE") return sectorValue * 3;
  return 0;
}

export function getHitScoreFromAim(
  aim?: { x: number; y: number },
  rouletteRadius: number = DEFAULT_ROULETTE_RADIUS,
  rouletteCenter: Point2D = DEFAULT_ROULETTE_CENTER
): number {
  if (!aim) return 0;

  const { distance } = getAimPositionAndDistance(aim, rouletteCenter);
  const ratio = distance / rouletteRadius;
  const zone = getZoneFromRatio(ratio);
  const sectorValue = getSectorValueFromAim(aim, rouletteCenter);

  return getScoreFromZone(zone, sectorValue);
}

export function getZoneFromAim(
  aim: { x: number; y: number },
  rouletteRadius: number = DEFAULT_ROULETTE_RADIUS,
  rouletteCenter: Point2D = DEFAULT_ROULETTE_CENTER
): Zone {
  const { distance } = getAimPositionAndDistance(aim, rouletteCenter);
  const ratio = distance / rouletteRadius;

  return getZoneFromRatio(ratio);
}
export { getSectorValueFromAim } from "@/lib/dartboardMath";
export { DEFAULT_ROULETTE_RADIUS } from "@/lib/dartboardConfig";
