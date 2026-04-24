import { useEffect, useRef, useState } from "react";
import { generateSessionToken } from "@/lib/session";
import { getRouletteRadius } from "../three/scoreMeasurement";

const ROOM = process.env.NEXT_PUBLIC_ROOM ?? "zipshow";

export default function useDisplayQrUrl(): string {
  const tokenRef = useRef<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!tokenRef.current) {
      tokenRef.current = generateSessionToken();
    }

    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const buildUrl = (radius?: number) => {
      const params = new URLSearchParams({ room: ROOM });
      if (typeof radius === "number" && radius > 0) {
        params.set("radius", radius.toString());
      }
      setMobileUrl(`${baseUrl}/auth/${tokenRef.current}?${params.toString()}`);
    };

    buildUrl();

    let lastRadius = 0;
    const intervalId = window.setInterval(() => {
      const radius = getRouletteRadius();
      if (!Number.isFinite(radius) || radius <= 0) return;
      const rounded = Math.round(radius * 1_000_000) / 1_000_000;
      if (rounded !== lastRadius) {
        lastRadius = rounded;
        buildUrl(rounded);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return mobileUrl;
}
