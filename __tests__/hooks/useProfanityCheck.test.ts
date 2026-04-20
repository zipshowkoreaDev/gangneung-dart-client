import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useProfanityCheck from "@/app/mobile/hooks/useProfanityCheck";

describe("hooks/useProfanityCheck", () => {
  describe("containsProfanity", () => {
    it("정상 텍스트는 false", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.containsProfanity("안녕하세요")).toBe(false);
      expect(result.current.containsProfanity("홍길동")).toBe(false);
      expect(result.current.containsProfanity("Player1")).toBe(false);
    });

    it("빈 문자열은 false", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.containsProfanity("")).toBe(false);
    });

    it("비속어 포함 시 true", () => {
      const { result } = renderHook(() => useProfanityCheck());

      // 일반적인 비속어 테스트 (profanity.json에 있는 단어)
      expect(result.current.containsProfanity("시발")).toBe(true);
      expect(result.current.containsProfanity("씨발")).toBe(true);
    });

    it("초성 비속어 감지", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.containsProfanity("ㅅㅂ")).toBe(true);
      expect(result.current.containsProfanity("ㅆㅂ")).toBe(true);
    });

    it("특수문자로 우회 시도 감지", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.containsProfanity("시 발")).toBe(true);
      expect(result.current.containsProfanity("시.발")).toBe(true);
    });
  });

  describe("findProfanities", () => {
    it("비속어 없으면 빈 배열", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.findProfanities("안녕하세요")).toEqual([]);
    });

    it("발견된 비속어 목록 반환", () => {
      const { result } = renderHook(() => useProfanityCheck());

      const found = result.current.findProfanities("시발");
      expect(found.length).toBeGreaterThan(0);
    });
  });

  describe("replaceProfanity", () => {
    it("비속어를 *로 치환", () => {
      const { result } = renderHook(() => useProfanityCheck());

      const replaced = result.current.replaceProfanity("시발");
      expect(replaced).not.toBe("시발");
      expect(replaced).toContain("*");
    });

    it("정상 텍스트는 그대로 유지", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.replaceProfanity("안녕하세요")).toBe("안녕하세요");
    });

    it("커스텀 치환 문자 사용", () => {
      const { result } = renderHook(() => useProfanityCheck());

      const replaced = result.current.replaceProfanity("시발", "#");
      expect(replaced).toContain("#");
    });

    it("빈 문자열은 빈 문자열 반환", () => {
      const { result } = renderHook(() => useProfanityCheck());

      expect(result.current.replaceProfanity("")).toBe("");
    });
  });

  describe("validateInput", () => {
    it("정상 입력은 유효", () => {
      const { result } = renderHook(() => useProfanityCheck());

      const validation = result.current.validateInput("홍길동");
      expect(validation.isValid).toBe(true);
      expect(validation.message).toBe("");
    });

    it("빈 입력은 유효", () => {
      const { result } = renderHook(() => useProfanityCheck());

      const validation = result.current.validateInput("");
      expect(validation.isValid).toBe(true);
    });

    it("비속어 포함 시 무효", () => {
      const { result } = renderHook(() => useProfanityCheck());

      const validation = result.current.validateInput("시발");
      expect(validation.isValid).toBe(false);
      expect(validation.message).toBe("부적절한 표현이 포함되어 있습니다.");
    });
  });
});
