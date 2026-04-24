import type { PlayerScore } from "@/app/display/types/player";
import { DART_TIME_LIMIT_MS, TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";

export type ActiveCountdown = {
  seconds: number;
  isWarning: boolean;
};

function getClampedSeconds(endsAt: number | undefined, now: number, maxMs: number) {
  if (!endsAt) return 0;

  const remainingMs = Math.max(0, endsAt - now);
  const maxSeconds = Math.ceil(maxMs / 1000);

  return Math.min(maxSeconds, Math.ceil(remainingMs / 1000));
}

export function getTurnDelaySeconds(player: PlayerScore, now: number) {
  return getClampedSeconds(player.turnDelayEndsAt, now, TURN_RESULT_DELAY_MS);
}

export function getDartTimeLeft(player: PlayerScore, now: number) {
  return getClampedSeconds(player.dartDeadlineEndsAt, now, DART_TIME_LIMIT_MS);
}

export function getActiveCountdown(
  players: Iterable<PlayerScore>,
  now: number
): ActiveCountdown | null {
  let activeCountdown: ActiveCountdown | null = null;

  for (const player of players) {
    if (player.isWaiting || !player.isConnected) continue;

    const turnDelaySeconds = getTurnDelaySeconds(player, now);
    const dartTimeLeft = getDartTimeLeft(player, now);
    const seconds = turnDelaySeconds > 0 ? turnDelaySeconds : dartTimeLeft;

    if (seconds <= 0) continue;

    const candidate = {
      seconds,
      isWarning: turnDelaySeconds === 0 && dartTimeLeft > 0 && dartTimeLeft <= 3,
    };

    if (!activeCountdown || candidate.seconds < activeCountdown.seconds) {
      activeCountdown = candidate;
    }
  }

  return activeCountdown;
}
