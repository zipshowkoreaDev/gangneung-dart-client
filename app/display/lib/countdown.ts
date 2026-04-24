import type { PlayerScore } from "@/app/display/types/player";

export function getTurnDelaySeconds(player: PlayerScore, now: number) {
  if (!player.turnDelayEndsAt) return 0;
  return Math.max(0, Math.ceil((player.turnDelayEndsAt - now) / 1000));
}

export function getDartTimeLeft(player: PlayerScore, now: number) {
  if (!player.dartDeadlineEndsAt) return 0;
  return Math.max(0, Math.ceil((player.dartDeadlineEndsAt - now) / 1000));
}
