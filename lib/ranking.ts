const STORAGE_KEY = "dart-ranking";
export const RANKING_LIMIT = 3;

export interface RankingEntry {
  name: string;
  score: number;
  timestamp: number;
}

export type RankingInput = Pick<RankingEntry, "name" | "score">;

interface RankingData {
  dateKey?: string;
  expiresAt: number;
  rankings: RankingEntry[];
}

function getLocalDateKey(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextLocalMidnight(timestamp: number = Date.now()): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime();
}

export function getMillisecondsUntilRankingReset(): number {
  return Math.max(0, getNextLocalMidnight() - Date.now());
}

function isExpired(data: RankingData): boolean {
  const todayKey = getLocalDateKey();

  if (data.dateKey) {
    return data.dateKey !== todayKey || Date.now() >= data.expiresAt;
  }

  const firstRanking = data.rankings[0];
  if (!firstRanking) {
    return Date.now() >= data.expiresAt;
  }

  return getLocalDateKey(firstRanking.timestamp) !== todayKey;
}

export function getRankings(): RankingEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data: RankingData = JSON.parse(raw);
    if (isExpired(data)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    return data.rankings;
  } catch {
    return [];
  }
}

function saveRankings(rankings: RankingEntry[]): RankingEntry[] {
  rankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.timestamp - a.timestamp;
  });

  const topRankings = rankings.slice(0, RANKING_LIMIT);
  const data: RankingData = {
    dateKey: getLocalDateKey(),
    expiresAt: getNextLocalMidnight(),
    rankings: topRankings,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 저장 실패 시 무시
  }

  return topRankings;
}

export function addRanking(name: string, score: number): RankingEntry[] {
  return addRankings([{ name, score }]);
}

export function addRankings(entries: RankingInput[]): RankingEntry[] {
  if (typeof window === "undefined") return [];

  const current = getRankings();
  const timestamp = Date.now();
  const newEntries = entries.map((entry, index) => ({
    ...entry,
    timestamp: timestamp + index,
  }));

  return saveRankings([...current, ...newEntries]);
}

export function clearRankings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
