// 점수 계산 상수
const CAMERA_Z = 50;
const PLANE_Z = 1;
const FOV = 50;
const CAMERA_DISTANCE = CAMERA_Z - PLANE_Z;
const HALF_FOV_RAD = (FOV / 2) * (Math.PI / 180);
const AIM_TO_3D_SCALE = CAMERA_DISTANCE * Math.tan(HALF_FOV_RAD);
const STANDARD_DARTBOARD_NUMBERS = [
  20, 1, 18, 4, 13,
  6, 10, 15, 2, 17,
  3, 19, 7, 16, 8,
  11, 14, 9, 12, 5,
] as const;

export const DEFAULT_ROULETTE_RADIUS = 8.105359363722414;

// Measured from the front-face radial boundaries of public/models/roulette.glb.
export const ZONE_RATIOS = {
  INNER_BULL: 0.062983,
  OUTER_BULL: 0.090578,
  INNER_SINGLE: 0.485541,
  TRIPLE: 0.521035,
  OUTER_SINGLE: 0.931585,
  DOUBLE: 0.995306,
} as const;

export const SCORES = {
  INNER_BULL: 50,
  OUTER_BULL: 25,
  MISS: 0,
} as const;

export type Zone =
  | "INNER_BULL"
  | "OUTER_BULL"
  | "TRIPLE"
  | "DOUBLE"
  | "SINGLE"
  | "MISS";
export type Point2D = { x: number; y: number };

const DEFAULT_ROULETTE_CENTER: Point2D = { x: 0, y: 0 };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function aimTo3D(aim: { x: number; y: number }): { x: number; y: number } {
  return {
    x: aim.x * AIM_TO_3D_SCALE,
    y: aim.y * AIM_TO_3D_SCALE,
  };
}

function getDistanceFromAim(
  aim: { x: number; y: number },
  rouletteCenter: Point2D
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

function getSectorValue(point: Point2D, rouletteCenter: Point2D): number {
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

export function getScoreFromZone(zone: Zone, sectorValue = 0): number {
  if (zone === "INNER_BULL" || zone === "OUTER_BULL" || zone === "MISS") {
    return SCORES[zone];
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

  const { distance, pos3D } = getDistanceFromAim(aim, rouletteCenter);
  const ratio = distance / rouletteRadius;
  const zone = getZoneFromRatio(ratio);
  const sectorValue = getSectorValue(pos3D, rouletteCenter);

  return getScoreFromZone(zone, sectorValue);
}

export function getZoneFromAim(
  aim: { x: number; y: number },
  rouletteRadius: number = DEFAULT_ROULETTE_RADIUS,
  rouletteCenter: Point2D = DEFAULT_ROULETTE_CENTER
): Zone {
  const { distance } = getDistanceFromAim(aim, rouletteCenter);
  const ratio = distance / rouletteRadius;

  return getZoneFromRatio(ratio);
}

export function getSectorValueFromAim(
  aim: { x: number; y: number },
  rouletteCenter: Point2D = DEFAULT_ROULETTE_CENTER
): number {
  const { pos3D } = getDistanceFromAim(aim, rouletteCenter);
  return getSectorValue(pos3D, rouletteCenter);
}
