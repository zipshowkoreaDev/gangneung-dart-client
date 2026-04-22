import type { PlayerSlot } from "@/lib/room";

export type PlayerScore = {
  socketId?: string;
  serverName?: string;
  slot?: PlayerSlot;
  name: string;
  score: number;
  isConnected: boolean;
  isReady: boolean;
  isWaiting?: boolean;
  totalThrows: number;
  currentThrows: number;
  throwScores: number[];
  turnDelayEndsAt?: number;
};
