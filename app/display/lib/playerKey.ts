import type { PlayerSlot } from "@/lib/room";

export function resolvePlayerKey(data: {
  playerId?: string;
  name?: string;
  socketId?: string;
}) {
  return data.socketId || data.playerId || "player";
}

export function getSlotPlayerKey(slot?: PlayerSlot) {
  return slot ? `slot-${slot}` : undefined;
}

export function getWaitingPlayerKey(socketId: string) {
  return `waiting-${socketId}`;
}

export function getPlayerSocketIds(
  players?: Array<{ socketId?: string }>
): string[] {
  return (
    players
      ?.map((player) => player.socketId)
      .filter((socketId): socketId is string => Boolean(socketId)) ?? []
  );
}
