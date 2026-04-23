import { describe, it, expect } from "vitest";
import { getSlotFromPosition } from "@/lib/room";

describe("lib/room", () => {
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
