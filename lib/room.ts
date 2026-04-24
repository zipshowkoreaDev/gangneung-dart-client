export const DEFAULT_ROOM = process.env.NEXT_PUBLIC_ROOM ?? "zipshow";
export const MAX_PLAYERS = 4;
export type PlayerSlot = 1 | 2 | 3 | 4;

export function getRoomFromUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ROOM;

  const params = new URLSearchParams(window.location.search);
  return params.get("room") || DEFAULT_ROOM;
}

export function getSlotFromPosition(position: number): PlayerSlot | null {
  const slot = position + 1;
  if (Number.isInteger(slot) && slot >= 1 && slot <= MAX_PLAYERS) {
    return slot as PlayerSlot;
  }
  return null;
}
