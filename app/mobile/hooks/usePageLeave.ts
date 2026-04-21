"use client";

import { useEffect } from "react";
import { socket } from "@/shared/socket";
import { debugLog } from "@/app/mobile/debugLog";

interface UsePageLeaveProps {
  joinedQueueRef: React.MutableRefObject<boolean>;
}

// 페이지 이탈 시 대기열 정리 hook
export function usePageLeave({ joinedQueueRef }: UsePageLeaveProps): void {
  useEffect(() => {
    const emitLeaveQueue = (reason: string) => {
      if (!joinedQueueRef.current) return;
      debugLog(`[Queue] leave-queue emit (${reason})`);
      try {
        socket.emit("leave-queue");
      } catch {
        // ignore
      }
      try {
        socket.timeout(200).emit("leave-queue");
      } catch {
        // ignore
      }
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    };

    const onPageHide = () => emitLeaveQueue("pagehide");
    const onBeforeUnload = () => emitLeaveQueue("beforeunload");
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitLeaveQueue("visibilitychange");
      }
    };
    const onFreeze = () => emitLeaveQueue("freeze");
    const onOffline = () => emitLeaveQueue("offline");

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("freeze", onFreeze as EventListener);
    window.addEventListener("offline", onOffline);

    return () => {
      if (joinedQueueRef.current) {
        emitLeaveQueue("unmount");
      }
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("freeze", onFreeze as EventListener);
      window.removeEventListener("offline", onOffline);
    };
  }, [joinedQueueRef]);
}
