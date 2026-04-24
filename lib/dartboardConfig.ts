export const DEFAULT_ROULETTE_RADIUS = 8.105359363722414;

export const STANDARD_DARTBOARD_NUMBERS = [
  20, 1, 18, 4, 13,
  6, 10, 15, 2, 17,
  3, 19, 7, 16, 8,
  11, 14, 9, 12, 5,
] as const;

// Measured from the front-face radial boundaries of public/models/roulette.glb.
export const ZONE_RATIOS = {
  INNER_BULL: 0.062983,
  OUTER_BULL: 0.090578,
  INNER_SINGLE: 0.485541,
  TRIPLE: 0.521035,
  OUTER_SINGLE: 0.931585,
  DOUBLE: 0.995306,
} as const;

export const BULL_SCORES = {
  INNER_BULL: 50,
  OUTER_BULL: 25,
  MISS: 0,
} as const;
