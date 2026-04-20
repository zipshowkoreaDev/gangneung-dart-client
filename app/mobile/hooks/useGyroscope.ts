import { useState, useRef, useCallback } from "react";

const AIM_HZ = 30;
const AIM_INTERVAL = 1000 / AIM_HZ;
const THROW_COOL_DOWN_MS = 700;

// 조준 각도 범위
const GAMMA_RANGE = 40; // X축 ±40도
const BETA_RANGE = 35;  // Y축 ±35도
const DEFAULT_NEUTRAL_BETA = 30; // 기본 영점 (약간 위로 들림)
const DEFAULT_NEUTRAL_GAMMA = 0;

// 던짐 감지 임계값 (iOS: 중력 포함 / Android: 중력 제외)
const THRESHOLD_WITH_GRAVITY = 28;
const RELEASE_THRESHOLD_WITH_GRAVITY = 15;
const THRESHOLD_WITHOUT_GRAVITY = 18;
const RELEASE_THRESHOLD_WITHOUT_GRAVITY = 8;

const CAMERA_Z = 50;
const PLANE_Z = 1;
const FOV = 50;
const CAMERA_DISTANCE = CAMERA_Z - PLANE_Z;
const HALF_FOV_RAD = (FOV / 2) * (Math.PI / 180);
const AIM_TO_3D_SCALE = CAMERA_DISTANCE * Math.tan(HALF_FOV_RAD);

const DEFAULT_ROULETTE_RADIUS = 8.105359363722414;

const ZONE_RATIOS = {
  BULL: 0.08,
  INNER_SINGLE: 0.47,
  TRIPLE: 0.54,
  OUTER_SINGLE: 0.93,
  DOUBLE: 1.0,
};

const SCORES = {
  BULL: 50,
  SINGLE: 10,
  TRIPLE: 30,
  DOUBLE: 20,
  MISS: 0,
};

export type HitZone = "bull" | "single" | "triple" | "double" | "miss";

interface HitResult {
  zone: HitZone;
  score: number;
}

interface UseGyroscopeProps {
  emitAimUpdate: (aim: { x: number; y: number }, skin?: string) => void;
  emitAimOff: () => void;
  emitThrowDart: (payload: {
    aim: { x: number; y: number };
    score: number;
    zone: HitZone;
  }) => void;
  rouletteRadius?: number;
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function getHitResult(
  aim: { x: number; y: number },
  rouletteRadius: number
): HitResult {
  const pos3D = {
    x: aim.x * AIM_TO_3D_SCALE,
    y: aim.y * AIM_TO_3D_SCALE,
  };
  const distance = Math.hypot(pos3D.x, pos3D.y);
  const ratio = distance / rouletteRadius;

  if (ratio <= ZONE_RATIOS.BULL) return { zone: "bull", score: SCORES.BULL };
  if (ratio <= ZONE_RATIOS.INNER_SINGLE) return { zone: "single", score: SCORES.SINGLE };
  if (ratio <= ZONE_RATIOS.TRIPLE) return { zone: "triple", score: SCORES.TRIPLE };
  if (ratio <= ZONE_RATIOS.OUTER_SINGLE) return { zone: "single", score: SCORES.SINGLE };
  if (ratio <= ZONE_RATIOS.DOUBLE) return { zone: "double", score: SCORES.DOUBLE };
  return { zone: "miss", score: SCORES.MISS };
}

export function useGyroscope({
  emitAimUpdate,
  emitAimOff,
  emitThrowDart,
  rouletteRadius,
}: UseGyroscopeProps) {
  const currentRouletteRadius =
    typeof rouletteRadius === "number" && rouletteRadius > 0
      ? rouletteRadius
      : DEFAULT_ROULETTE_RADIUS;

  const [aimPosition, setAimPosition] = useState({ x: 0, y: 0 });
  const [sensorsReady, setSensorsReady] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [throwsLeft, setThrowsLeft] = useState(3);
  const [hasFinishedTurn, setHasFinishedTurn] = useState(false);
  const [myScore, setMyScore] = useState(0);

  const sensorsActiveRef = useRef(false);
  const lastAimSentRef = useRef(0);
  const lastAimRef = useRef({ x: 0, y: 0 });
  const aimRef = useRef({ x: 0, y: 0 });
  const throwCountRef = useRef(0);
  const throwBlockedUntilRef = useRef(0);

  const neutralBetaRef = useRef(DEFAULT_NEUTRAL_BETA);
  const neutralGammaRef = useRef(DEFAULT_NEUTRAL_GAMMA);
  const currentOriRef = useRef({ beta: DEFAULT_NEUTRAL_BETA, gamma: DEFAULT_NEUTRAL_GAMMA });

  const isTrackingRef = useRef(false);
  const peakMagRef = useRef(0);

  const handleOrientationRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const handleMotionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const requestMotionPermission = async (): Promise<boolean> => {
    try {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent
      ) {
        const result = await (
          DeviceMotionEvent as unknown as { requestPermission(): Promise<string> }
        ).requestPermission();
        if (result !== "granted") {
          setSensorError("모션 권한이 필요합니다.");
          return false;
        }
      }

      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        const result = await (
          DeviceOrientationEvent as unknown as { requestPermission(): Promise<string> }
        ).requestPermission();
        if (result !== "granted") {
          setSensorError("방향 권한이 필요합니다.");
          return false;
        }
      }

      setSensorError("");
      return true;
    } catch {
      setSensorError("센서 권한 요청에 실패했습니다.");
      return false;
    }
  };

  const calibrate = useCallback(() => {
    neutralBetaRef.current = currentOriRef.current.beta;
    neutralGammaRef.current = currentOriRef.current.gamma;
    if ("vibrate" in navigator) navigator.vibrate(100);
  }, []);

  const stopSensors = useCallback(() => {
    if (!sensorsActiveRef.current) return;

    sensorsActiveRef.current = false;
    setSensorsReady(false);
    setThrowsLeft(0);
    throwCountRef.current = 0;
    isTrackingRef.current = false;
    peakMagRef.current = 0;

    if (handleOrientationRef.current) {
      window.removeEventListener("deviceorientation", handleOrientationRef.current);
      handleOrientationRef.current = null;
    }
    if (handleMotionRef.current) {
      window.removeEventListener("devicemotion", handleMotionRef.current);
      handleMotionRef.current = null;
    }

    emitAimOff();
  }, [emitAimOff]);

  const startSensors = useCallback(() => {
    if (sensorsActiveRef.current) return;

    sensorsActiveRef.current = true;
    setSensorsReady(true);
    setHasFinishedTurn(false);
    setThrowsLeft(3);
    setMyScore(0);
    throwCountRef.current = 0;
    throwBlockedUntilRef.current = 0;
    isTrackingRef.current = false;
    peakMagRef.current = 0;

    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? DEFAULT_NEUTRAL_BETA;
      const gamma = e.gamma ?? DEFAULT_NEUTRAL_GAMMA;

      currentOriRef.current = { beta, gamma };

      const x = clamp((gamma - neutralGammaRef.current) / GAMMA_RANGE);
      const y = -clamp((beta - neutralBetaRef.current) / BETA_RANGE);

      // 변화가 미미하면 emit 생략
      const dx = Math.abs(x - lastAimRef.current.x);
      const dy = Math.abs(y - lastAimRef.current.y);

      aimRef.current = { x, y };
      setAimPosition({ x, y });

      if (dx > 0.01 || dy > 0.01) {
        const now = performance.now();
        if (now - lastAimSentRef.current > AIM_INTERVAL) {
          lastAimSentRef.current = now;
          lastAimRef.current = { x, y };
          emitAimUpdate({ x, y });
        }
      }
    };

    handleMotionRef.current = (e: DeviceMotionEvent) => {
      const now = performance.now();
      if (now < throwBlockedUntilRef.current) return;

      const usingGravity = !e.acceleration;
      const acc = e.acceleration ?? e.accelerationIncludingGravity ?? { x: 0, y: 0, z: 0 };
      const mag = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);

      const threshold = usingGravity ? THRESHOLD_WITH_GRAVITY : THRESHOLD_WITHOUT_GRAVITY;
      const releaseThreshold = usingGravity ? RELEASE_THRESHOLD_WITH_GRAVITY : RELEASE_THRESHOLD_WITHOUT_GRAVITY;

      if (!isTrackingRef.current) {
        if (mag > threshold) {
          isTrackingRef.current = true;
          peakMagRef.current = mag;
        }
      } else {
        if (mag > peakMagRef.current) {
          peakMagRef.current = mag;
        }

        if (mag < releaseThreshold) {
          isTrackingRef.current = false;
          throwBlockedUntilRef.current = now + THROW_COOL_DOWN_MS;

          const hitResult = getHitResult(aimRef.current, currentRouletteRadius);
          setMyScore((prev) => prev + hitResult.score);

          emitThrowDart({
            aim: aimRef.current,
            score: hitResult.score,
            zone: hitResult.zone,
          });

          if ("vibrate" in navigator) navigator.vibrate(50);

          throwCountRef.current += 1;
          setThrowsLeft((prev) => Math.max(0, prev - 1));
          peakMagRef.current = 0;

          if (throwCountRef.current >= 3) {
            setHasFinishedTurn(true);
            setTimeout(() => stopSensors(), 3000);
          }
        }
      }
    };

    window.addEventListener("deviceorientation", handleOrientationRef.current);
    window.addEventListener("devicemotion", handleMotionRef.current);
  }, [stopSensors, emitAimUpdate, emitThrowDart, currentRouletteRadius]);

  return {
    aimPosition,
    sensorsReady,
    sensorError,
    throwsLeft,
    hasFinishedTurn,
    myScore,
    startSensors,
    stopSensors,
    requestMotionPermission,
    setHasFinishedTurn,
    calibrate,
  };
}
