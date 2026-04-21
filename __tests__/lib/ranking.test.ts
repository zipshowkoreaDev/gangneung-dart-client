import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getRankings,
  addRanking,
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

    it("R-2-2: Top 5만 유지", () => {
      addRanking("Player1", 10);
      addRanking("Player2", 20);
      addRanking("Player3", 30);
      addRanking("Player4", 40);
      addRanking("Player5", 50);
      const result = addRanking("Player6", 60);

      expect(result).toHaveLength(5);
      expect(result[0].score).toBe(60);
      expect(result[4].score).toBe(20);
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
