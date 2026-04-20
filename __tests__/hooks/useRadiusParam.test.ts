import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useRadiusParam from "@/app/mobile/hooks/useRadiusParam";

describe("hooks/useRadiusParam", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // window.location mock 초기화
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("radius 파라미터 없으면 undefined", () => {
    window.location.search = "";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBeUndefined();
  });

  it("유효한 radius 파라미터 파싱", () => {
    window.location.search = "?radius=8.5";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBe(8.5);
  });

  it("정수 radius 파라미터 파싱", () => {
    window.location.search = "?radius=10";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBe(10);
  });

  it("0 이하 값은 undefined", () => {
    window.location.search = "?radius=0";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBeUndefined();
  });

  it("음수 값은 undefined", () => {
    window.location.search = "?radius=-5";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBeUndefined();
  });

  it("숫자가 아닌 값은 undefined", () => {
    window.location.search = "?radius=abc";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBeUndefined();
  });

  it("다른 파라미터와 함께 있어도 정상 파싱", () => {
    window.location.search = "?room=test&radius=12.5&slot=1";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBe(12.5);
  });

  it("Infinity는 undefined", () => {
    window.location.search = "?radius=Infinity";

    const { result } = renderHook(() => useRadiusParam());

    expect(result.current).toBeUndefined();
  });
});
