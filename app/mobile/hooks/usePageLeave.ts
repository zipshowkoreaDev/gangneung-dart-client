"use client";

import { useEffect } from "react";

interface UsePageLeaveProps {
  onLeave: () => void;
}

// 페이지 이탈 시 로비 정리 hook
export function usePageLeave({ onLeave }: UsePageLeaveProps): void {
  useEffect(() => {
    const onPageHide = () => onLeave();
    const onBeforeUnload = () => onLeave();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onLeave();
      }
    };
    const onFreeze = () => onLeave();
    const onOffline = () => onLeave();

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("freeze", onFreeze as EventListener);
    window.addEventListener("offline", onOffline);

    return () => {
      onLeave();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("freeze", onFreeze as EventListener);
      window.removeEventListener("offline", onOffline);
    };
  }, [onLeave]);
}
