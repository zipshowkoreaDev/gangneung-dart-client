import type { PlayerScore } from "@/app/display/types/player";
import {
  getWaitingPlayerKey,
  getSlotPlayerKey,
  resolvePlayerKey,
} from "@/app/display/lib/playerKey";
import type { PlayerSlot } from "@/lib/room";

type PlayerIdentity = {
  playerId?: string;
  name?: string;
  socketId?: string;
  slot?: PlayerSlot;
};

export function resolveDisplayPlayerKey(
  data: PlayerIdentity,
  options: {
    aliasMap: Map<string, string>;
    getWaitingSocketSlot: (socketId?: string) => PlayerSlot | undefined;
  }
) {
  const slotKey = getSlotPlayerKey(
    data.slot ?? options.getWaitingSocketSlot(data.socketId)
  );
  if (slotKey) return slotKey;

  const aliases = [data.socketId, data.playerId, data.name].filter(
    Boolean
  ) as string[];
  for (const alias of aliases) {
    const mappedKey = options.aliasMap.get(alias);
    if (mappedKey) return mappedKey;
  }

  return resolvePlayerKey(data);
}

export function rememberPlayerAliases(
  aliasMap: Map<string, string>,
  key: string,
  data: PlayerIdentity
) {
  [data.socketId, data.playerId, data.name]
    .filter(Boolean)
    .forEach((alias) => {
      aliasMap.set(alias as string, key);
    });
}

export function getExistingPlayerEntry(
  playersMap: Map<string, PlayerScore>,
  key: string,
  data: { name?: string; socketId?: string }
): [string, PlayerScore] | undefined {
  const waitingKey = data.socketId ? getWaitingPlayerKey(data.socketId) : undefined;
  const candidates = [key, waitingKey].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const player = playersMap.get(candidate);
    if (player) return [candidate, player];
  }

  return Array.from(playersMap.entries()).find(
    ([, player]) =>
      (data.socketId && player.socketId === data.socketId) ||
      (data.name && player.serverName === data.name)
  );
}

export function removeDuplicateWaitingPlayers(
  playersMap: Map<string, PlayerScore>,
  keepKey: string,
  socketId?: string
) {
  if (!socketId) return;

  const waitingKey = getWaitingPlayerKey(socketId);
  if (waitingKey !== keepKey) {
    playersMap.delete(waitingKey);
  }

  Array.from(playersMap.entries()).forEach(([entryKey, player]) => {
    if (
      entryKey !== keepKey &&
      player.isWaiting &&
      player.socketId === socketId
    ) {
      playersMap.delete(entryKey);
    }
  });
}
