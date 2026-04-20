const DEFAULT_ROOM = process.env.NEXT_PUBLIC_ROOM ?? "zipshow";
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

export function getPlayerRoom(baseRoom: string, playerSlot: PlayerSlot): string {
  return `game-${baseRoom}-player${playerSlot}`;
}

export function getDisplayRoom(baseRoom: string): string {
  return `game-${baseRoom}-display`;
}

export function getAllPlayerRooms(baseRoom: string): string[] {
  return Array.from({ length: MAX_PLAYERS }, (_, i) =>
    getPlayerRoom(baseRoom, (i + 1) as PlayerSlot)
  );
}

export function extractPlayerSlot(roomName: string): PlayerSlot | null {
  const match = roomName.match(/^game-[^-]+-player([1-4])$/);
  return match ? (parseInt(match[1], 10) as PlayerSlot) : null;
}

export function isPlayerRoom(roomName: string): boolean {
  return /^game-[^-]+-player[1-4]$/.test(roomName);
}

export function isDisplayRoom(roomName: string): boolean {
  return /^game-[^-]+-display$/.test(roomName);
}
