import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useNameInputFlow from "@/app/mobile/hooks/useNameInputFlow";

describe("hooks/useNameInputFlow", () => {
  describe("초기 상태", () => {
    it("name은 빈 문자열", () => {
      const { result } = renderHook(() => useNameInputFlow());

      expect(result.current.name).toBe("");
    });

    it("socketName은 빈 문자열", () => {
      const { result } = renderHook(() => useNameInputFlow());

      expect(result.current.socketName).toBe("");
    });

    it("errorMessage는 빈 문자열", () => {
      const { result } = renderHook(() => useNameInputFlow());

      expect(result.current.errorMessage).toBe("");
    });
  });

  describe("setName", () => {
    it("이름 설정", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      expect(result.current.name).toBe("홍길동");
    });

    it("socketName에 suffix 추가", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      expect(result.current.socketName).toMatch(/^홍길동#[a-z0-9]{4}$/);
    });

    it("빈 문자열 설정 시 초기화", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      act(() => {
        result.current.setName("");
      });

      expect(result.current.name).toBe("");
      expect(result.current.socketName).toBe("");
    });

    it("공백만 있는 경우 초기화", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("   ");
      });

      expect(result.current.name).toBe("");
      expect(result.current.socketName).toBe("");
    });

    it("suffix는 한 번 설정되면 유지", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      const firstSocketName = result.current.socketName;

      act(() => {
        result.current.setName("김철수");
      });

      // suffix는 같고 이름만 변경
      const suffix = firstSocketName.split("#")[1];
      expect(result.current.socketName).toBe(`김철수#${suffix}`);
    });
  });

  describe("errorMessage (욕설 검증)", () => {
    it("정상 이름은 에러 없음", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      expect(result.current.errorMessage).toBe("");
    });

    it("비속어 포함 시 에러 메시지", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("시발");
      });

      expect(result.current.errorMessage).toBe(
        "부적절한 표현이 포함되어 있습니다."
      );
    });

    it("초성 비속어도 에러", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("ㅅㅂ");
      });

      expect(result.current.errorMessage).toBe(
        "부적절한 표현이 포함되어 있습니다."
      );
    });
  });

  describe("reset", () => {
    it("모든 상태 초기화", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      expect(result.current.name).toBe("홍길동");

      act(() => {
        result.current.reset();
      });

      expect(result.current.name).toBe("");
      expect(result.current.socketName).toBe("");
      expect(result.current.errorMessage).toBe("");
    });

    it("reset 후 새 suffix 생성", () => {
      const { result } = renderHook(() => useNameInputFlow());

      act(() => {
        result.current.setName("홍길동");
      });

      const firstSuffix = result.current.socketName.split("#")[1];

      act(() => {
        result.current.reset();
      });

      act(() => {
        result.current.setName("김철수");
      });

      const secondSuffix = result.current.socketName.split("#")[1];

      expect(firstSuffix).not.toBe(secondSuffix);
    });
  });
});
