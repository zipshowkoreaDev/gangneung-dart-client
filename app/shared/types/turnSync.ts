export type AimPoint = { x: number; y: number };

export type TurnSyncState = {
  currentThrows: number;
  totalThrows: number;
  score: number;
  throwScores: number[];
  thrownAims: AimPoint[];
};

export const INITIAL_TURN_SYNC_STATE: TurnSyncState = {
  currentThrows: 0,
  totalThrows: 0,
  score: 0,
  throwScores: [],
  thrownAims: [],
};
