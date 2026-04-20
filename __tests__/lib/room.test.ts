import { describe, it, expect } from "vitest";
import {
  getPlayerRoom,
  getDisplayRoom,
  getAllPlayerRooms,
  extractPlayerSlot,
  isPlayerRoom,
  isDisplayRoom,
  getSlotFromPosition,
} from "@/lib/room";

describe("lib/room", () => {
  describe("getPlayerRoom", () => {
    it("RM-1-1: 슬롯 1 방 이름 생성", () => {
      const result = getPlayerRoom("zipshow", 1);
      expect(result).toBe("game-zipshow-player1");
    });

    it("RM-1-2: 슬롯 2 방 이름 생성", () => {
      const result = getPlayerRoom("zipshow", 2);
      expect(result).toBe("game-zipshow-player2");
    });

    it("RM-1-3: 슬롯 4 방 이름 생성", () => {
      const result = getPlayerRoom("zipshow", 4);
      expect(result).toBe("game-zipshow-player4");
    });

    it("RM-1-4: 다른 방 이름으로 생성", () => {
      const result = getPlayerRoom("testroom", 1);
      expect(result).toBe("game-testroom-player1");
    });
  });

  describe("getDisplayRoom", () => {
    it("RM-2-1: 디스플레이 방 이름 생성", () => {
      const result = getDisplayRoom("zipshow");
      expect(result).toBe("game-zipshow-display");
    });
  });

  describe("getAllPlayerRooms", () => {
    it("RM-2-2: 모든 플레이어 방 목록 반환", () => {
      const result = getAllPlayerRooms("zipshow");
      expect(result).toEqual([
        "game-zipshow-player1",
        "game-zipshow-player2",
        "game-zipshow-player3",
        "game-zipshow-player4",
      ]);
    });
  });

  describe("extractPlayerSlot", () => {
    it("RM-5-1: player1 방에서 슬롯 1 추출", () => {
      const result = extractPlayerSlot("game-zipshow-player1");
      expect(result).toBe(1);
    });

    it("RM-5-2: player2 방에서 슬롯 2 추출", () => {
      const result = extractPlayerSlot("game-zipshow-player2");
      expect(result).toBe(2);
    });

    it("RM-5-3: player4 방에서 슬롯 4 추출", () => {
      const result = extractPlayerSlot("game-zipshow-player4");
      expect(result).toBe(4);
    });

    it("RM-5-4: 디스플레이 방은 null 반환", () => {
      const result = extractPlayerSlot("game-zipshow-display");
      expect(result).toBeNull();
    });

    it("RM-5-5: 잘못된 형식은 null 반환", () => {
      const result = extractPlayerSlot("invalid-room");
      expect(result).toBeNull();
    });
  });

  describe("isPlayerRoom", () => {
    it("플레이어 방 확인 - true", () => {
      expect(isPlayerRoom("game-zipshow-player1")).toBe(true);
      expect(isPlayerRoom("game-zipshow-player2")).toBe(true);
      expect(isPlayerRoom("game-zipshow-player3")).toBe(true);
      expect(isPlayerRoom("game-zipshow-player4")).toBe(true);
    });

    it("플레이어 방 확인 - false", () => {
      expect(isPlayerRoom("game-zipshow-display")).toBe(false);
      expect(isPlayerRoom("game-zipshow-player5")).toBe(false);
      expect(isPlayerRoom("invalid")).toBe(false);
    });
  });

  describe("isDisplayRoom", () => {
    it("디스플레이 방 확인 - true", () => {
      expect(isDisplayRoom("game-zipshow-display")).toBe(true);
    });

    it("디스플레이 방 확인 - false", () => {
      expect(isDisplayRoom("game-zipshow-player1")).toBe(false);
      expect(isDisplayRoom("invalid")).toBe(false);
    });
  });

  describe("getSlotFromPosition", () => {
    it("position 0은 슬롯 1", () => {
      expect(getSlotFromPosition(0)).toBe(1);
    });

    it("position 1은 슬롯 2", () => {
      expect(getSlotFromPosition(1)).toBe(2);
    });

    it("position 2는 슬롯 3", () => {
      expect(getSlotFromPosition(2)).toBe(3);
    });

    it("position 3은 슬롯 4", () => {
      expect(getSlotFromPosition(3)).toBe(4);
    });

    it("position 4 이상은 null", () => {
      expect(getSlotFromPosition(4)).toBeNull();
      expect(getSlotFromPosition(99)).toBeNull();
    });

    it("음수 position은 null", () => {
      const result = getSlotFromPosition(-1);
      expect(result).toBeNull();
    });
  });
});
