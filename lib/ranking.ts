const STORAGE_KEY = "dart-ranking";

export interface RankingEntry {
  name: string;
  score: number;
  timestamp: number;
}

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

export function addRanking(name: string, score: number): RankingEntry[] {
  if (typeof window === "undefined") return [];

  const current = getRankings();
  const newEntry: RankingEntry = {
    name,
    score,
    timestamp: Date.now(),
  };

  // 기존 랭킹에 새 기록 추가
  const updated = [...current, newEntry];

  // 정렬: 점수 내림차순, 동점 시 최신 기록 우선
  updated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.timestamp - a.timestamp;
  });

  // Top 5만 유지
  const top5 = updated.slice(0, 5);

  const data: RankingData = {
    dateKey: getLocalDateKey(),
    expiresAt: getNextLocalMidnight(),
    rankings: top5,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 저장 실패 시 무시
  }

  return top5;
}

export function clearRankings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
