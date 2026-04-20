import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDisplayState from "@/app/display/hooks/useDisplayState";

const createPlayer = (name = "홍길동") => ({
  name,
  score: 0,
  isConnected: true,
  isReady: true,
  totalThrows: 0,
  currentThrows: 0,
});

describe("hooks/useDisplayState", () => {
  describe("초기 상태", () => {
    it("aimPositions는 빈 Map", () => {
      const { result } = renderHook(() => useDisplayState());

      expect(result.current.aimPositions).toBeInstanceOf(Map);
      expect(result.current.aimPositions.size).toBe(0);
    });

    it("players는 빈 Map", () => {
      const { result } = renderHook(() => useDisplayState());

      expect(result.current.players).toBeInstanceOf(Map);
      expect(result.current.players.size).toBe(0);
    });

    it("playerOrder는 빈 배열", () => {
      const { result } = renderHook(() => useDisplayState());

      expect(result.current.playerOrder).toEqual([]);
    });
  });

  describe("setAimPositions", () => {
    it("조준 위치 추가", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setAimPositions((prev) => {
          const next = new Map(prev);
          next.set("player1", { x: 0.5, y: 0.3 });
          return next;
        });
      });

      expect(result.current.aimPositions.size).toBe(1);
      expect(result.current.aimPositions.get("player1")).toEqual({
        x: 0.5,
        y: 0.3,
      });
    });

    it("조준 위치 업데이트", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setAimPositions((prev) => {
          const next = new Map(prev);
          next.set("player1", { x: 0.5, y: 0.3 });
          return next;
        });
      });

      act(() => {
        result.current.setAimPositions((prev) => {
          const next = new Map(prev);
          next.set("player1", { x: 0.8, y: 0.9 });
          return next;
        });
      });

      expect(result.current.aimPositions.get("player1")).toEqual({
        x: 0.8,
        y: 0.9,
      });
    });

    it("skin 정보 포함", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setAimPositions((prev) => {
          const next = new Map(prev);
          next.set("player1", { x: 0.5, y: 0.3, skin: "red" });
          return next;
        });
      });

      expect(result.current.aimPositions.get("player1")?.skin).toBe("red");
    });
  });

  describe("setPlayers", () => {
    it("플레이어 추가", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setPlayers((prev) => {
          const next = new Map(prev);
          next.set("player1", createPlayer());
          return next;
        });
      });

      expect(result.current.players.size).toBe(1);
      expect(result.current.players.get("player1")?.name).toBe("홍길동");
    });

    it("플레이어 점수 업데이트", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setPlayers((prev) => {
          const next = new Map(prev);
          next.set("player1", createPlayer());
          return next;
        });
      });

      act(() => {
        result.current.setPlayers((prev) => {
          const next = new Map(prev);
          const player = next.get("player1");
          if (player) {
            next.set("player1", { ...player, score: 50 });
          }
          return next;
        });
      });

      expect(result.current.players.get("player1")?.score).toBe(50);
    });

    it("플레이어 삭제", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setPlayers((prev) => {
          const next = new Map(prev);
          next.set("player1", createPlayer());
          return next;
        });
      });

      act(() => {
        result.current.setPlayers((prev) => {
          const next = new Map(prev);
          next.delete("player1");
          return next;
        });
      });

      expect(result.current.players.size).toBe(0);
    });
  });

  describe("setPlayerOrder", () => {
    it("플레이어 순서 설정", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setPlayerOrder(["player1", "player2"]);
      });

      expect(result.current.playerOrder).toEqual(["player1", "player2"]);
    });

    it("플레이어 순서 추가", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setPlayerOrder(["player1"]);
      });

      act(() => {
        result.current.setPlayerOrder((prev) => [...prev, "player2"]);
      });

      expect(result.current.playerOrder).toEqual(["player1", "player2"]);
    });

    it("플레이어 순서에서 제거", () => {
      const { result } = renderHook(() => useDisplayState());

      act(() => {
        result.current.setPlayerOrder(["player1", "player2", "player3"]);
      });

      act(() => {
        result.current.setPlayerOrder((prev) =>
          prev.filter((p) => p !== "player2")
        );
      });

      expect(result.current.playerOrder).toEqual(["player1", "player3"]);
    });
  });

  describe("setPlayerRoomCounts", () => {
    it("함수가 존재함", () => {
      const { result } = renderHook(() => useDisplayState());

      expect(typeof result.current.setPlayerRoomCounts).toBe("function");
    });
  });
});
