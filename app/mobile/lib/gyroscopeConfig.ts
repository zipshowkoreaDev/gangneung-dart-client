export const GYROSCOPE_CONFIG = {
  aimHz: 30,
  throwCoolDownMs: 700,
  outOfBoundsAim: { x: 2, y: 2 },
  aim: {
    gammaRange: 40,
    betaRange: 35,
    defaultNeutralBeta: 30,
    defaultNeutralGamma: 0,
    minDeltaToEmit: 0.01,
  },
  throwDetection: {
    withGravity: {
      threshold: 28,
      releaseThreshold: 15,
    },
    withoutGravity: {
      threshold: 18,
      releaseThreshold: 8,
    },
  },
} as const;

export const AIM_INTERVAL_MS = 1000 / GYROSCOPE_CONFIG.aimHz;
