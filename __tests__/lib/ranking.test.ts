import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getRankings,
  addRanking,
  addRankings,
  clearRankings,
  getMillisecondsUntilRankingReset,
} from "@/lib/ranking";

describe("lib/ranking", () => {
  beforeEach(() => {
    clearRankings();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getRankings", () => {
    it("R-1-1: 데이터 없으면 빈 배열 반환", () => {
      const result = getRankings();
      expect(result).toEqual([]);
    });

    it("R-1-2: 저장된 랭킹 정상 조회", () => {
      addRanking("홍길동", 100);
      const result = getRankings();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("홍길동");
      expect(result[0].score).toBe(100);
    });

    it("R-1-3: 날짜가 바뀌면 랭킹 초기화", () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date(2024, 0, 1, 23, 59, 0));
      addRanking("홍길동", 100);

      vi.setSystemTime(new Date(2024, 0, 2, 0, 0, 0));
      const result = getRankings();

      expect(result).toEqual([]);
    });
  });

  describe("addRanking", () => {
    it("R-2-1: 첫 기록 추가", () => {
      const result = addRanking("홍길동", 100);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("홍길동");
      expect(result[0].score).toBe(100);
    });

    it("R-2-2: Top 3만 유지", () => {
      const result = addRankings([
        { name: "Player1", score: 10 },
        { name: "Player2", score: 20 },
        { name: "Player3", score: 30 },
        { name: "Player4", score: 40 },
        { name: "Player5", score: 50 },
        { name: "Player6", score: 60 },
        { name: "Player7", score: 70 },
        { name: "Player8", score: 80 },
        { name: "Player9", score: 90 },
        { name: "Player10", score: 100 },
        { name: "Player11", score: 110 },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].score).toBe(110);
      expect(result[2].score).toBe(90);
      expect(result.find((entry) => entry.name === "Player1")).toBeUndefined();
    });

    it("R-2-3: 점수 내림차순 정렬", () => {
      addRanking("Low", 10);
      addRanking("High", 100);
      const result = addRanking("Mid", 50);

      expect(result[0].name).toBe("High");
      expect(result[1].name).toBe("Mid");
      expect(result[2].name).toBe("Low");
    });

    it("R-2-4: 동점 시 최신 기록 우선", () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date("2024-01-01T00:00:00"));
      addRanking("First", 100);

      vi.setSystemTime(new Date("2024-01-01T00:00:01"));
      const result = addRanking("Second", 100);

      vi.useRealTimers();

      expect(result[0].name).toBe("Second");
      expect(result[1].name).toBe("First");
    });

    it("R-2-5: 날짜가 바뀐 뒤 추가하면 새 날짜 랭킹만 유지", () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date(2024, 0, 1, 23, 59, 0));
      addRanking("Yesterday", 100);

      vi.setSystemTime(new Date(2024, 0, 2, 0, 0, 0));
      const result = addRanking("Today", 50);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Today");
      expect(result[0].score).toBe(50);
    });
  });

  describe("getMillisecondsUntilRankingReset", () => {
    it("R-4-1: 다음 자정까지 남은 시간 반환", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1, 23, 59, 0));

      expect(getMillisecondsUntilRankingReset()).toBe(60 * 1000);
    });
  });

  describe("clearRankings", () => {
    it("R-3-1: 랭킹 삭제", () => {
      addRanking("홍길동", 100);
      clearRankings();
      const result = getRankings();

      expect(result).toEqual([]);
    });
  });
});
