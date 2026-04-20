import { useState } from "react";

export default function useRadiusParam(): number | undefined {
  const [radius] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const radiusParam = params.get("radius");
    if (!radiusParam) return undefined;
    const parsed = Number(radiusParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  });

  return radius;
}
