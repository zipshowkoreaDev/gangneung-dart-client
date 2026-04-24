import { describe, expect, it } from "vitest";
import {
  getActiveCountdown,
  getDartTimeLeft,
  getTurnDelaySeconds,
} from "@/app/display/lib/countdown";
import type { PlayerScore } from "@/app/display/types/player";

function createPlayer(overrides: Partial<PlayerScore> = {}): PlayerScore {
  return {
    name: "player",
    score: 0,
    isConnected: true,
    isReady: true,
    totalThrows: 0,
    currentThrows: 0,
    throwScores: [],
    ...overrides,
  };
}

describe("display countdown", () => {
  it("dart timer is clamped to 10 seconds even when now is slightly older", () => {
    const now = 1_000;
    const player = createPlayer({ dartDeadlineEndsAt: 11_001 });

    expect(getDartTimeLeft(player, now)).toBe(10);
  });

  it("turn delay is clamped to 5 seconds", () => {
    const now = 1_000;
    const player = createPlayer({ turnDelayEndsAt: 6_500 });

    expect(getTurnDelaySeconds(player, now)).toBe(5);
  });

  it("ignores waiting or disconnected players with stale deadlines", () => {
    const now = 1_000;
    const active = createPlayer({ dartDeadlineEndsAt: 10_500 });
    const waiting = createPlayer({
      isWaiting: true,
      dartDeadlineEndsAt: 266_000,
    });
    const disconnected = createPlayer({
      isConnected: false,
      dartDeadlineEndsAt: 200_000,
    });

    expect(getActiveCountdown([waiting, disconnected, active], now)).toEqual({
      seconds: 10,
      isWarning: false,
    });
  });

  it("uses the smallest active countdown instead of the first player in the map", () => {
    const now = 1_000;
    const latePlayer = createPlayer({ dartDeadlineEndsAt: 10_500 });
    const urgentPlayer = createPlayer({ dartDeadlineEndsAt: 2_100 });

    expect(getActiveCountdown([latePlayer, urgentPlayer], now)).toEqual({
      seconds: 2,
      isWarning: true,
    });
  });
});
