// 점수 계산 상수
const CAMERA_Z = 50;
const PLANE_Z = 1;
const FOV = 50;
const CAMERA_DISTANCE = CAMERA_Z - PLANE_Z;
const HALF_FOV_RAD = (FOV / 2) * (Math.PI / 180);
const AIM_TO_3D_SCALE = CAMERA_DISTANCE * Math.tan(HALF_FOV_RAD);

export const DEFAULT_ROULETTE_RADIUS = 8.105359363722414;

export const ZONE_RATIOS = {
  BULL: 0.15,
  INNER_SINGLE: 0.6,
  TRIPLE: 0.725,
  OUTER_SINGLE: 0.9,
  DOUBLE: 0.98,
} as const;

export const SCORES = {
  BULL: 50,
  SINGLE: 10,
  TRIPLE: 30,
  DOUBLE: 20,
  MISS: 0,
} as const;

export type Zone = "BULL" | "TRIPLE" | "DOUBLE" | "SINGLE" | "MISS";
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
): number {
  const pos3D = aimTo3D({
    x: clamp(aim.x, -1, 1),
    y: clamp(aim.y, -1, 1),
  });

  return Math.hypot(
    pos3D.x - rouletteCenter.x,
    pos3D.y - rouletteCenter.y
  );
}

export function getZoneFromRatio(ratio: number): Zone {
  if (ratio <= ZONE_RATIOS.BULL) return "BULL";
  if (ratio <= ZONE_RATIOS.INNER_SINGLE) return "SINGLE";
  if (ratio <= ZONE_RATIOS.TRIPLE) return "TRIPLE";
  if (ratio <= ZONE_RATIOS.OUTER_SINGLE) return "SINGLE";
  if (ratio <= ZONE_RATIOS.DOUBLE) return "DOUBLE";
  return "MISS";
}

export function getScoreFromZone(zone: Zone): number {
  return SCORES[zone];
}

export function getHitScoreFromAim(
  aim?: { x: number; y: number },
  rouletteRadius: number = DEFAULT_ROULETTE_RADIUS,
  rouletteCenter: Point2D = DEFAULT_ROULETTE_CENTER
): number {
  if (!aim) return 0;

  const distance = getDistanceFromAim(aim, rouletteCenter);
  const ratio = distance / rouletteRadius;
  const zone = getZoneFromRatio(ratio);

  return getScoreFromZone(zone);
}

export function getZoneFromAim(
  aim: { x: number; y: number },
  rouletteRadius: number = DEFAULT_ROULETTE_RADIUS,
  rouletteCenter: Point2D = DEFAULT_ROULETTE_CENTER
): Zone {
  const distance = getDistanceFromAim(aim, rouletteCenter);
  const ratio = distance / rouletteRadius;

  return getZoneFromRatio(ratio);
}
