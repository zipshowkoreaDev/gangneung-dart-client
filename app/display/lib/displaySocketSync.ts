import { DISPLAY_EVENTS } from "@/lib/displayEvents";
import type { PlayerScore } from "@/app/display/types/player";

export const THROW_DUPLICATE_WINDOW_MS = 1000;

export function createThrowFingerprint(data: {
  key: string;
  socketId?: string;
  score?: number;
  aim?: { x: number; y: number };
}) {
  return JSON.stringify({
    key: data.key,
    socketId: data.socketId,
    score: data.score,
    aimX: Number((data.aim?.x ?? 0).toFixed(4)),
    aimY: Number((data.aim?.y ?? 0).toFixed(4)),
  });
}

export function isRecentDuplicateThrow(
  recentFingerprints: Map<string, number>,
  fingerprint: string,
  now: number,
) {
  const lastSeenAt = recentFingerprints.get(fingerprint);
  return (
    typeof lastSeenAt === "number" &&
    now - lastSeenAt < THROW_DUPLICATE_WINDOW_MS
  );
}

export function rememberThrowFingerprint(
  recentFingerprints: Map<string, number>,
  fingerprint: string,
  now: number,
) {
  recentFingerprints.set(fingerprint, now);
  Array.from(recentFingerprints.entries()).forEach(
    ([existingFingerprint, seenAt]) => {
      if (now - seenAt >= THROW_DUPLICATE_WINDOW_MS) {
        recentFingerprints.delete(existingFingerprint);
      }
    },
  );
}

export function collectRemovedPlayerKeys(
  players: Map<string, PlayerScore>,
  joinedSocketIds: string[],
) {
  const joinedSocketIdSet = new Set(joinedSocketIds);
  const removedPlayerKeys: string[] = [];

  Array.from(players.entries()).forEach(([key, player]) => {
    if (!player.socketId || joinedSocketIdSet.has(player.socketId)) {
      return;
    }

    if (player.isWaiting || player.isConnected) {
      players.delete(key);
      removedPlayerKeys.push(key);
    }
  });

  return removedPlayerKeys;
}

export function clearDisconnectedPlayers(params: {
  finishedPlayerKeys: Set<string>;
  playerAliases: Map<string, string>;
  playerLastScores: Map<string, { name: string; score: number }>;
  removedPlayerKeys: string[];
  setAimPositions: React.Dispatch<
    React.SetStateAction<Map<string, { x: number; y: number; skin?: string }>>
  >;
  onLog?: (msg: string) => void;
}) {
  const { removedPlayerKeys } = params;
  if (removedPlayerKeys.length === 0) return;

  const removedKeySet = new Set(removedPlayerKeys);

  params.setAimPositions((prev) => {
    const next = new Map(prev);
    removedPlayerKeys.forEach((key) => next.delete(key));
    return next;
  });

  removedPlayerKeys.forEach((key) => {
    params.playerLastScores.delete(key);
    params.finishedPlayerKeys.delete(key);
    params.playerAliases.delete(key);
    window.dispatchEvent(
      new CustomEvent(DISPLAY_EVENTS.clearPlayerDarts, { detail: { key } }),
    );
  });

  params.onLog?.(
    `Removed disconnected players: ${Array.from(removedKeySet).join(", ")}`,
  );
}
