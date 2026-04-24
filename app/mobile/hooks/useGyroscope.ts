import { useState, useRef, useCallback, useEffect } from "react";
import {
  DEFAULT_ROULETTE_RADIUS,
  getScoreFromZone,
  getZoneFromAim,
  type Zone,
} from "@/lib/score";
import { DART_TIME_LIMIT_MS, TURN_RESULT_DELAY_MS } from "@/lib/gameTiming";

const AIM_HZ = 30;
const AIM_INTERVAL = 1000 / AIM_HZ;
const THROW_COOL_DOWN_MS = 700;
const OUT_OF_BOUNDS_AIM = { x: 2, y: 2 };

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
    zone: HitZone;
    score: number;
  }) => void;
  rouletteRadius?: number;
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function toHitZone(zone: Zone): HitZone {
  return zone.toLowerCase() as HitZone;
}

function getHitResult(
  aim: { x: number; y: number },
  rouletteRadius: number
): HitResult {
  const zone = getZoneFromAim(aim, rouletteRadius);
  return {
    zone: toHitZone(zone),
    score: getScoreFromZone(zone),
  };
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

  const [sensorsReady, setSensorsReady] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [throwsLeft, setThrowsLeft] = useState(3);
  const [hasFinishedTurn, setHasFinishedTurn] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [dartTimeLeft, setDartTimeLeft] = useState(
    DART_TIME_LIMIT_MS / 1000
  );

  const sensorsActiveRef = useRef(false);
  const lastAimSentRef = useRef(0);
  const lastAimRef = useRef({ x: 0, y: 0 });
  const aimRef = useRef({ x: 0, y: 0 });
  const throwCountRef = useRef(0);
  const throwBlockedUntilRef = useRef(0);
  const dartTimerIdRef = useRef<number | null>(null);
  const turnFinishTimerIdRef = useRef<number | null>(null);
  const startDartTimerRef = useRef<() => void>(() => {});

  const neutralBetaRef = useRef(DEFAULT_NEUTRAL_BETA);
  const neutralGammaRef = useRef(DEFAULT_NEUTRAL_GAMMA);
  const currentOriRef = useRef({ beta: DEFAULT_NEUTRAL_BETA, gamma: DEFAULT_NEUTRAL_GAMMA });

  const isTrackingRef = useRef(false);
  const peakMagRef = useRef(0);

  const handleOrientationRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const handleMotionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const clearDartTimer = useCallback(() => {
    if (dartTimerIdRef.current === null) return;
    window.clearInterval(dartTimerIdRef.current);
    dartTimerIdRef.current = null;
  }, []);

  const clearTurnFinishTimer = useCallback(() => {
    if (turnFinishTimerIdRef.current === null) return;
    window.clearTimeout(turnFinishTimerIdRef.current);
    turnFinishTimerIdRef.current = null;
  }, []);

  const stopSensors = useCallback(() => {
    if (!sensorsActiveRef.current) return;

    sensorsActiveRef.current = false;
    setSensorsReady(false);
    setThrowsLeft(0);
    clearDartTimer();
    clearTurnFinishTimer();
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
  }, [clearDartTimer, clearTurnFinishTimer, emitAimOff]);

  const finishTurn = useCallback(() => {
    setHasFinishedTurn(true);
    clearDartTimer();

    if (handleMotionRef.current) {
      window.removeEventListener("devicemotion", handleMotionRef.current);
      handleMotionRef.current = null;
    }

    clearTurnFinishTimer();
    turnFinishTimerIdRef.current = window.setTimeout(() => {
      turnFinishTimerIdRef.current = null;
      stopSensors();
    }, TURN_RESULT_DELAY_MS);
  }, [clearDartTimer, clearTurnFinishTimer, stopSensors]);

  const completeThrow = useCallback(
    (hitResult: HitResult, aim: { x: number; y: number }) => {
      if (!sensorsActiveRef.current || throwCountRef.current >= 3) return;

      setTotalScore((prev) => prev + hitResult.score);
      emitThrowDart({
        aim,
        zone: hitResult.zone,
        score: hitResult.score,
      });

      throwCountRef.current += 1;
      setThrowsLeft((prev) => Math.max(0, prev - 1));
      setDartTimeLeft(DART_TIME_LIMIT_MS / 1000);
      peakMagRef.current = 0;

      if (throwCountRef.current >= 3) {
        finishTurn();
        return;
      }

      startDartTimerRef.current();
    },
    [emitThrowDart, finishTurn]
  );

  const startDartTimer = useCallback(() => {
    clearDartTimer();
    setDartTimeLeft(DART_TIME_LIMIT_MS / 1000);

    const startedAt = Date.now();
    dartTimerIdRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remainingMs = Math.max(0, DART_TIME_LIMIT_MS - elapsed);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setDartTimeLeft(remainingSeconds);

      if (remainingMs > 0) return;

      clearDartTimer();
      completeThrow({ zone: "miss", score: 0 }, OUT_OF_BOUNDS_AIM);
    }, 250);
  }, [clearDartTimer, completeThrow]);

  useEffect(() => {
    startDartTimerRef.current = startDartTimer;
  }, [startDartTimer]);

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

  const startSensors = useCallback(() => {
    if (sensorsActiveRef.current) return;

    sensorsActiveRef.current = true;
    setSensorsReady(true);
    setHasFinishedTurn(false);
    setThrowsLeft(3);
    setTotalScore(0);
    setDartTimeLeft(DART_TIME_LIMIT_MS / 1000);
    throwCountRef.current = 0;
    throwBlockedUntilRef.current = 0;
    isTrackingRef.current = false;
    peakMagRef.current = 0;
    clearTurnFinishTimer();

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
      if (throwCountRef.current >= 3) return;

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
          clearDartTimer();
          completeThrow(hitResult, aimRef.current);

          if ("vibrate" in navigator) navigator.vibrate(50);
        }
      }
    };

    startDartTimer();
    emitAimUpdate(aimRef.current);

    window.addEventListener("deviceorientation", handleOrientationRef.current);
    window.addEventListener("devicemotion", handleMotionRef.current);
  }, [
    clearDartTimer,
    clearTurnFinishTimer,
    completeThrow,
    emitAimUpdate,
    currentRouletteRadius,
    startDartTimer,
  ]);

  return {
    sensorsReady,
    sensorError,
    throwsLeft,
    dartTimeLeft,
    hasFinishedTurn,
    totalScore,
    startSensors,
    stopSensors,
    requestMotionPermission,
    setHasFinishedTurn,
    calibrate,
  };
}
