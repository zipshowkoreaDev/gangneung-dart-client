"use client";

import { useEffect, useRef } from "react";

interface UsePageLeaveProps {
  onLeave: () => void;
}

// 페이지 이탈 시 로비 정리 hook
export function usePageLeave({ onLeave }: UsePageLeaveProps): void {
  const onLeaveRef = useRef(onLeave);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    const onPageHide = () => onLeaveRef.current();
    const onBeforeUnload = () => onLeaveRef.current();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onLeaveRef.current();
      }
    };
    const onFreeze = () => onLeaveRef.current();
    const onOffline = () => onLeaveRef.current();

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("freeze", onFreeze as EventListener);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("freeze", onFreeze as EventListener);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
}
