import { useEffect, useRef } from "react";

type UseWakeLockParams = {
  enabled: boolean;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request(type: "screen"): Promise<{
      release(): Promise<void>;
      released: boolean;
      addEventListener?: (
        type: "release",
        listener: () => void,
      ) => void;
    }>;
  };
};

export default function useWakeLock({ enabled }: UseWakeLockParams) {
  const sentinelRef = useRef<{
    release(): Promise<void>;
    released: boolean;
  } | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;

    const releaseWakeLock = async () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (!sentinel || sentinel.released) return;
      try {
        await sentinel.release();
      } catch {
        // Ignore release errors from unsupported or already released states.
      }
    };

    const requestWakeLock = async () => {
      const nav = navigator as NavigatorWithWakeLock;
      if (!nav.wakeLock || document.visibilityState !== "visible") return;

      try {
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Some browsers deny wake lock without a recent user gesture or on low battery.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        return;
      }
      void releaseWakeLock();
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [enabled]);
}
