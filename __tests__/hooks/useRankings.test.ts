import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useRankings from "@/app/display/hooks/useRankings";
import { clearRankings, addRanking } from "@/lib/ranking";

describe("hooks/useRankings", () => {
  beforeEach(() => {
    clearRankings();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("초기 상태", () => {
    it("랭킹 데이터 없으면 빈 배열", () => {
      const { result } = renderHook(() => useRankings());

      expect(result.current.rankings).toEqual([]);
    });

    it("기존 랭킹 데이터 로드", async () => {
      // 미리 데이터 추가
      addRanking("홍길동", 100);
      addRanking("김철수", 80);

      const { result } = renderHook(() => useRankings());

      await waitFor(() => {
        expect(result.current.rankings).toHaveLength(2);
      });
      expect(result.current.rankings[0].name).toBe("홍길동");
      expect(result.current.rankings[0].score).toBe(100);
    });
  });

  describe("handlePlayersFinish", () => {
    it("플레이어 점수 추가", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([{ name: "홍길동", score: 100 }]);
      });

      expect(result.current.rankings).toHaveLength(1);
      expect(result.current.rankings[0].name).toBe("홍길동");
      expect(result.current.rankings[0].score).toBe(100);
    });

    it("여러 플레이어 점수 추가 및 정렬", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([
          { name: "홍길동", score: 50 },
          { name: "김철수", score: 100 },
          { name: "이영희", score: 75 },
        ]);
      });

      expect(result.current.rankings).toHaveLength(3);
      expect(result.current.rankings[0].name).toBe("김철수");
      expect(result.current.rankings[0].score).toBe(100);
      expect(result.current.rankings[1].name).toBe("이영희");
      expect(result.current.rankings[1].score).toBe(75);
      expect(result.current.rankings[2].name).toBe("홍길동");
      expect(result.current.rankings[2].score).toBe(50);
    });

    it("Top 10만 유지", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([
          { name: "P1", score: 10 },
          { name: "P2", score: 20 },
          { name: "P3", score: 30 },
          { name: "P4", score: 40 },
          { name: "P5", score: 50 },
          { name: "P6", score: 60 },
          { name: "P7", score: 70 },
          { name: "P8", score: 80 },
          { name: "P9", score: 90 },
          { name: "P10", score: 100 },
          { name: "P11", score: 110 },
        ]);
      });

      expect(result.current.rankings).toHaveLength(10);
      expect(result.current.rankings[0].name).toBe("P11");
      expect(result.current.rankings[0].score).toBe(110);
      // P1 (10점)은 제외됨
      expect(result.current.rankings.find((r) => r.name === "P1")).toBeUndefined();
    });

    it("0점도 정상 추가", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([{ name: "실패자", score: 0 }]);
      });

      expect(result.current.rankings).toHaveLength(1);
      expect(result.current.rankings[0].score).toBe(0);
    });

    it("같은 이름도 전달된 플레이어 수만큼 저장", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([
          { name: "홍길동", score: 50 },
          { name: "홍길동", score: 100 },
        ]);
      });

      expect(result.current.rankings).toHaveLength(2);
      expect(result.current.rankings[0].score).toBe(100);
      expect(result.current.rankings[1].score).toBe(50);
    });

    it("같은 게임 결과는 한 번만 저장", () => {
      const { result } = renderHook(() => useRankings());
      const players = [
        { name: "홍길동", score: 50 },
        { name: "김철수", score: 30 },
      ];

      act(() => {
        result.current.handlePlayersFinish(players, "game-1");
      });
      act(() => {
        result.current.handlePlayersFinish(players, "game-1");
      });

      expect(result.current.rankings).toHaveLength(2);
      expect(
        result.current.rankings.filter((entry) => entry.name === "홍길동")
      ).toHaveLength(1);
    });
  });

  describe("localStorage 연동", () => {
    it("handlePlayersFinish 후 localStorage에 저장", async () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([{ name: "홍길동", score: 100 }]);
      });

      // 새 Hook 인스턴스에서 데이터 확인
      const { result: result2 } = renderHook(() => useRankings());

      await waitFor(() => {
        expect(result2.current.rankings).toHaveLength(1);
      });
      expect(result2.current.rankings[0].name).toBe("홍길동");
    });

    it("자정을 넘기면 화면 랭킹 상태 초기화", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1, 23, 59, 59));

      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayersFinish([{ name: "홍길동", score: 100 }]);
      });

      expect(result.current.rankings).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(2 * 1000);
      });

      expect(result.current.rankings).toEqual([]);
    });
  });
});
