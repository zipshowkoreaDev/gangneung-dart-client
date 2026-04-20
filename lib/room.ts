const DEFAULT_ROOM = process.env.NEXT_PUBLIC_ROOM ?? "zipshow";
const MAX_PLAYERS = 2;

export function getRoomFromUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ROOM;

  const params = new URLSearchParams(window.location.search);
  return params.get("room") || DEFAULT_ROOM;
}

export function getSlotFromUrl(): 1 | 2 | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const slot = params.get("slot");

  if (slot === "1") return 1;
  if (slot === "2") return 2;
  return null;
}

export function getSlotFromPosition(position: number): 1 | 2 | null {
  if (position === 0) return 1;
  if (position === 1) return 2;
  return null;
}

export function getPlayerRoom(baseRoom: string, playerSlot: 1 | 2): string {
  return `game-${baseRoom}-player${playerSlot}`;
}

export function getDisplayRoom(baseRoom: string): string {
  return `game-${baseRoom}-display`;
}

export function getAllPlayerRooms(baseRoom: string): string[] {
  return Array.from({ length: MAX_PLAYERS }, (_, i) =>
    getPlayerRoom(baseRoom, (i + 1) as 1 | 2)
  );
}

export function extractPlayerSlot(roomName: string): 1 | 2 | null {
  const match = roomName.match(/^game-[^-]+-player([12])$/);
  return match ? (parseInt(match[1]) as 1 | 2) : null;
}

export function isPlayerRoom(roomName: string): boolean {
  return /^game-[^-]+-player[12]$/.test(roomName);
}

export function isDisplayRoom(roomName: string): boolean {
  return /^game-[^-]+-display$/.test(roomName);
}

const SLOT_EXPIRY_MS = 60 * 1000; // 1분 후 슬롯 만료

function getOccupiedSlots(room: string): Set<1 | 2> {
  if (typeof window === "undefined") return new Set();

  const key = `slots_${room}`;
  const stored = localStorage.getItem(key);
  if (!stored) return new Set();

  try {
    const parsed = JSON.parse(stored);
    const now = Date.now();

    // 만료된 슬롯 데이터는 무시
    if (parsed.updatedAt && now - parsed.updatedAt > SLOT_EXPIRY_MS) {
      localStorage.removeItem(key);
      return new Set();
    }

    return new Set(parsed.slots || []);
  } catch {
    return new Set();
  }
}

function saveOccupiedSlots(room: string, slots: Set<1 | 2>): void {
  if (typeof window === "undefined") return;

  const key = `slots_${room}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      slots: Array.from(slots),
      updatedAt: Date.now(),
    })
  );
}

export function assignEmptySlot(room: string): 1 | 2 | null {
  const occupied = getOccupiedSlots(room);

  if (!occupied.has(1)) {
    occupied.add(1);
    saveOccupiedSlots(room, occupied);
    return 1;
  }

  if (!occupied.has(2)) {
    occupied.add(2);
    saveOccupiedSlots(room, occupied);
    return 2;
  }

  return null;
}

export function releaseSlot(room: string, slot: 1 | 2): void {
  const occupied = getOccupiedSlots(room);
  occupied.delete(slot);
  saveOccupiedSlots(room, occupied);
}

export function refreshSlot(room: string, slot: 1 | 2): void {
  const occupied = getOccupiedSlots(room);
  if (occupied.has(slot)) {
    saveOccupiedSlots(room, occupied);
  }
}

export function clearAllSlots(room: string): void {
  if (typeof window === "undefined") return;
  const key = `slots_${room}`;
  localStorage.removeItem(key);
}

export function createRoom(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
