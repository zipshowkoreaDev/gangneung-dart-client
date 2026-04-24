import {
  STANDARD_DARTBOARD_NUMBERS,
  ZONE_RATIOS,
} from "@/lib/dartboardConfig";
import type { Point2D, Zone } from "@/lib/score";

const CAMERA_Z = 50;
const PLANE_Z = 1;
const FOV = 50;
const CAMERA_DISTANCE = CAMERA_Z - PLANE_Z;
const HALF_FOV_RAD = (FOV / 2) * (Math.PI / 180);
const AIM_TO_3D_SCALE = CAMERA_DISTANCE * Math.tan(HALF_FOV_RAD);

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function aimTo3D(aim: Point2D): Point2D {
  return {
    x: aim.x * AIM_TO_3D_SCALE,
    y: aim.y * AIM_TO_3D_SCALE,
  };
}

export function getAimPositionAndDistance(
  aim: Point2D,
  rouletteCenter: Point2D,
): { distance: number; pos3D: Point2D } {
  const pos3D = aimTo3D({
    x: clamp(aim.x, -1, 1),
    y: clamp(aim.y, -1, 1),
  });

  return {
    distance: Math.hypot(pos3D.x - rouletteCenter.x, pos3D.y - rouletteCenter.y),
    pos3D,
  };
}

export function getSectorValue(point: Point2D, rouletteCenter: Point2D): number {
  const angleRad = Math.atan2(point.y - rouletteCenter.y, point.x - rouletteCenter.x);
  const angleDeg = (90 - (angleRad * 180) / Math.PI + 360) % 360;
  const sectorIndex =
    Math.floor((angleDeg + 9) / 18) % STANDARD_DARTBOARD_NUMBERS.length;

  return STANDARD_DARTBOARD_NUMBERS[sectorIndex] ?? 0;
}

export function getZoneFromRatio(ratio: number): Zone {
  if (ratio <= ZONE_RATIOS.INNER_BULL) return "INNER_BULL";
  if (ratio <= ZONE_RATIOS.OUTER_BULL) return "OUTER_BULL";
  if (ratio <= ZONE_RATIOS.INNER_SINGLE) return "SINGLE";
  if (ratio <= ZONE_RATIOS.TRIPLE) return "TRIPLE";
  if (ratio <= ZONE_RATIOS.OUTER_SINGLE) return "SINGLE";
  if (ratio <= ZONE_RATIOS.DOUBLE) return "DOUBLE";
  return "MISS";
}

export function getSectorValueFromAim(
  aim: Point2D,
  rouletteCenter: Point2D = { x: 0, y: 0 },
): number {
  const { pos3D } = getAimPositionAndDistance(aim, rouletteCenter);
  return getSectorValue(pos3D, rouletteCenter);
}
