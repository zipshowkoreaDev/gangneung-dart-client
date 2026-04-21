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

  describe("handlePlayerFinish", () => {
    it("플레이어 점수 추가", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayerFinish("홍길동", 100);
      });

      expect(result.current.rankings).toHaveLength(1);
      expect(result.current.rankings[0].name).toBe("홍길동");
      expect(result.current.rankings[0].score).toBe(100);
    });

    it("여러 플레이어 점수 추가 및 정렬", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayerFinish("홍길동", 50);
      });
      act(() => {
        result.current.handlePlayerFinish("김철수", 100);
      });
      act(() => {
        result.current.handlePlayerFinish("이영희", 75);
      });

      expect(result.current.rankings).toHaveLength(3);
      expect(result.current.rankings[0].name).toBe("김철수");
      expect(result.current.rankings[0].score).toBe(100);
      expect(result.current.rankings[1].name).toBe("이영희");
      expect(result.current.rankings[1].score).toBe(75);
      expect(result.current.rankings[2].name).toBe("홍길동");
      expect(result.current.rankings[2].score).toBe(50);
    });

    it("Top 5만 유지", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayerFinish("P1", 10);
      });
      act(() => {
        result.current.handlePlayerFinish("P2", 20);
      });
      act(() => {
        result.current.handlePlayerFinish("P3", 30);
      });
      act(() => {
        result.current.handlePlayerFinish("P4", 40);
      });
      act(() => {
        result.current.handlePlayerFinish("P5", 50);
      });
      act(() => {
        result.current.handlePlayerFinish("P6", 60);
      });

      expect(result.current.rankings).toHaveLength(5);
      expect(result.current.rankings[0].name).toBe("P6");
      expect(result.current.rankings[0].score).toBe(60);
      // P1 (10점)은 제외됨
      expect(result.current.rankings.find((r) => r.name === "P1")).toBeUndefined();
    });

    it("0점도 정상 추가", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayerFinish("실패자", 0);
      });

      expect(result.current.rankings).toHaveLength(1);
      expect(result.current.rankings[0].score).toBe(0);
    });

    it("같은 이름으로 여러 번 추가 가능", () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayerFinish("홍길동", 50);
      });
      act(() => {
        result.current.handlePlayerFinish("홍길동", 100);
      });

      expect(result.current.rankings).toHaveLength(2);
      expect(result.current.rankings[0].score).toBe(100);
      expect(result.current.rankings[1].score).toBe(50);
    });
  });

  describe("localStorage 연동", () => {
    it("handlePlayerFinish 후 localStorage에 저장", async () => {
      const { result } = renderHook(() => useRankings());

      act(() => {
        result.current.handlePlayerFinish("홍길동", 100);
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
        result.current.handlePlayerFinish("홍길동", 100);
      });

      expect(result.current.rankings).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(2 * 1000);
      });

      expect(result.current.rankings).toEqual([]);
    });
  });
});
