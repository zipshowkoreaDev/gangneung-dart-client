import { useState, useRef, useCallback } from "react";

const ARMING_MS = 600;
const MAG_THRESH = 18;
const JERK_THRESH = 8;
const THROW_COOL_DOWN_MS = 700;
const AIM_HZ = 30;
const AIM_INTERVAL = 1000 / AIM_HZ;
const BASELINE_SAMPLES = 12;

// 3D 좌표 변환 상수
const CAMERA_Z = 50;
const PLANE_Z = 1;
const FOV = 50;
const CAMERA_DISTANCE = CAMERA_Z - PLANE_Z;
const HALF_FOV_RAD = (FOV / 2) * (Math.PI / 180);
const AIM_TO_3D_SCALE = CAMERA_DISTANCE * Math.tan(HALF_FOV_RAD);

const DEFAULT_ROULETTE_RADIUS = 8.105359363722414;

// 다트판 구역 비율 (중심 기준)
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

function aimTo3D(aim: { x: number; y: number }): { x: number; y: number } {
  return {
    x: aim.x * AIM_TO_3D_SCALE,
    y: aim.y * AIM_TO_3D_SCALE,
  };
}

function getHitResult(
  aim: { x: number; y: number },
  rouletteRadius: number
): HitResult {
  const pos3D = aimTo3D(aim);
  const distance = Math.hypot(pos3D.x, pos3D.y);
  const ratio = distance / rouletteRadius;

  if (ratio <= ZONE_RATIOS.BULL) {
    return { zone: "bull", score: SCORES.BULL };
  }
  if (ratio <= ZONE_RATIOS.INNER_SINGLE) {
    return { zone: "single", score: SCORES.SINGLE };
  }
  if (ratio <= ZONE_RATIOS.TRIPLE) {
    return { zone: "triple", score: SCORES.TRIPLE };
  }
  if (ratio <= ZONE_RATIOS.OUTER_SINGLE) {
    return { zone: "single", score: SCORES.SINGLE };
  }
  if (ratio <= ZONE_RATIOS.DOUBLE) {
    return { zone: "double", score: SCORES.DOUBLE };
  }
  return { zone: "miss", score: SCORES.MISS };
}

export function useGyroscope({
  emitAimUpdate,
  emitAimOff,
  emitThrowDart,
  rouletteRadius,
}: UseGyroscopeProps) {
  // 룰렛 반지름 값 결정 (URL 파라미터 우선)
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
  const gravityZRef = useRef(0);
  const filteredGravityZRef = useRef(0);
  const faceUpRef = useRef(true);
  const isIOSRef = useRef(false);
  const aimRef = useRef(aimPosition);
  const readyRef = useRef(true);
  const aimReadyRef = useRef(false);
  const throwCountRef = useRef(0);
  const baseGammaSumRef = useRef(0);
  const baseBetaSumRef = useRef(0);
  const baseAlphaSumRef = useRef(0);
  const baseSamplesRef = useRef(0);
  const baseGammaRef = useRef(0);
  const baseBetaRef = useRef(0);
  const baseAlphaRef = useRef(0);
  const armedAtRef = useRef(0);
  const baselineSumRef = useRef(0);
  const baselineSamplesRef = useRef(0);
  const prevMagRef = useRef(0);
  const throwBlockedUntilRef = useRef(0);
  const handleOrientationRef = useRef<
    ((e: DeviceOrientationEvent) => void) | null
  >(null);
  const handleMotionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const smoothedXRef = useRef(0);
  const prevAlphaDeltaRef = useRef(0);

  const norm = (v: number, a: number, b: number) =>
    Math.max(-1, Math.min(1, ((v - a) / (b - a)) * 2 - 1));

  // iOS 권한 요청
  const requestMotionPermission = async (): Promise<boolean> => {
    try {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        "requestPermission" in DeviceMotionEvent
      ) {
        const result = await (
          DeviceMotionEvent as unknown as {
            requestPermission(): Promise<string>;
          }
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
          DeviceOrientationEvent as unknown as {
            requestPermission(): Promise<string>;
          }
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

  // 센서 정지 및 상태 초기화
  const stopSensors = useCallback(() => {
    if (!sensorsActiveRef.current) return;

    sensorsActiveRef.current = false;
    setSensorsReady(false);
    setThrowsLeft(0);
    readyRef.current = true;
    throwCountRef.current = 0;
    baseGammaSumRef.current = 0;
    baseBetaSumRef.current = 0;
    baseAlphaSumRef.current = 0;
    baseSamplesRef.current = 0;
    baseAlphaRef.current = 0;

    if (handleOrientationRef.current) {
      window.removeEventListener(
        "deviceorientation",
        handleOrientationRef.current
      );
      handleOrientationRef.current = null;
    }
    if (handleMotionRef.current) {
      window.removeEventListener("devicemotion", handleMotionRef.current);
      handleMotionRef.current = null;
    }

    emitAimOff();
  }, [emitAimOff]);

  // 센서 시작 및 초기 보정/상태 세팅
  const startSensors = useCallback(() => {
    if (sensorsActiveRef.current) return;

    sensorsActiveRef.current = true;
    setSensorsReady(true);
    setHasFinishedTurn(false);
    setThrowsLeft(3);
    setMyScore(0);
    readyRef.current = true;
    aimReadyRef.current = false;
    throwCountRef.current = 0;
    baseGammaSumRef.current = 0;
    baseBetaSumRef.current = 0;
    baseAlphaSumRef.current = 0;
    baseSamplesRef.current = 0;
    baseGammaRef.current = 0;
    baseBetaRef.current = 0;
    baseAlphaRef.current = 0;
    armedAtRef.current = performance.now();
    baselineSumRef.current = 0;
    baselineSamplesRef.current = 0;
    prevMagRef.current = 0;
    throwBlockedUntilRef.current = 0;
    smoothedXRef.current = 0;
    prevAlphaDeltaRef.current = 0;

    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);
    isIOSRef.current = isIOS;
    const gammaRange = isIOS ? 35 : 35;
    const betaRange = isIOS ? 35 : 35;
    const alphaRange = isIOS ? 40 : 25;
    if (isIOS) {
      faceUpRef.current = true;
    }

    const deltaAngle = (current: number, base: number) => {
      let delta = current - base;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      return delta;
    };

    // 기기 방향 → 조준 좌표 계산
    handleOrientationRef.current = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      const alpha = e.alpha ?? 0;

      if (baseSamplesRef.current < BASELINE_SAMPLES) {
        baseGammaSumRef.current += gamma;
        baseBetaSumRef.current += beta;
        baseAlphaSumRef.current += alpha;
        baseSamplesRef.current += 1;
        if (baseSamplesRef.current === BASELINE_SAMPLES) {
          baseGammaRef.current = baseGammaSumRef.current / BASELINE_SAMPLES;
          baseBetaRef.current = baseBetaSumRef.current / BASELINE_SAMPLES;
          baseAlphaRef.current = baseAlphaSumRef.current / BASELINE_SAMPLES;
        }
      }

      const g = gamma - baseGammaRef.current;
      const b = beta - baseBetaRef.current;
      const a = deltaAngle(alpha, baseAlphaRef.current);

      let x = norm(g, -gammaRange, gammaRange);
      let y0 = isIOS
        ? norm(b, -betaRange, betaRange)
        : -norm(b, -betaRange, betaRange);

      // 눕힌 상태(화면이 천장)에서는 yaw(alpha)을 X, roll(gamma)을 Y로 사용
      if (faceUpRef.current) {
        // alpha 급격한 변화 감지 (gimbal lock 방지)
        const alphaDelta = Math.abs(a - prevAlphaDeltaRef.current);
        prevAlphaDeltaRef.current = a;

        let rawX = -norm(a, -alphaRange, alphaRange);

        // 급격한 변화(90도 이상) 시 이전 값 유지
        if (alphaDelta > 90) {
          rawX = smoothedXRef.current;
        }

        // smoothing 적용 (0.3 = 새 값 30%, 이전 값 70%)
        smoothedXRef.current = smoothedXRef.current * 0.7 + rawX * 0.3;
        x = smoothedXRef.current;

        y0 = norm(g, -gammaRange, gammaRange);
      }

      const y = faceUpRef.current ? -y0 : y0;

      aimRef.current = { x, y };
      setAimPosition({ x, y });
      aimReadyRef.current = true;

      const now = performance.now();
      if (now - lastAimSentRef.current > AIM_INTERVAL) {
        lastAimSentRef.current = now;
        emitAimUpdate({ x, y });
      }
    };

    // 던짐 감지 (가속도 변화 기반)
    handleMotionRef.current = (e: DeviceMotionEvent) => {
      const ag = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      gravityZRef.current = ag.z || 0;
      filteredGravityZRef.current =
        filteredGravityZRef.current * 0.8 + gravityZRef.current * 0.2;

      // iOS는 눕힌 상태 고정 (faceUp 토글 방지)
      if (!isIOSRef.current) {
        // iOS 외 디바이스: faceUp 판정 흔들림 방지 (히스테리시스 적용)
        const FACE_UP_ON = -4;
        const FACE_UP_OFF = -2;
        if (!faceUpRef.current && filteredGravityZRef.current < FACE_UP_ON) {
          faceUpRef.current = true;
        } else if (
          faceUpRef.current &&
          filteredGravityZRef.current > FACE_UP_OFF
        ) {
          faceUpRef.current = false;
        }
      } else {
        faceUpRef.current = true;
      }

      const now = performance.now();
      if (now < throwBlockedUntilRef.current) {
        return;
      }

      const a = e.acceleration || ag;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);

      if (now - armedAtRef.current < ARMING_MS) {
        baselineSumRef.current += mag;
        baselineSamplesRef.current += 1;
        prevMagRef.current = mag;
        return;
      }

      const baseline = baselineSamplesRef.current
        ? baselineSumRef.current / baselineSamplesRef.current
        : 0;
      const magAdj = Math.max(0, mag - baseline);
      const jerk = mag - prevMagRef.current;
      prevMagRef.current = mag;

      if (
        readyRef.current &&
        aimReadyRef.current &&
        magAdj > MAG_THRESH &&
        jerk > JERK_THRESH
      ) {
        readyRef.current = false;
        throwBlockedUntilRef.current = now + THROW_COOL_DOWN_MS;

        // 던짐 점수 계산 및 전송
        const hitResult = getHitResult(aimRef.current, currentRouletteRadius);
        setMyScore((prev) => prev + hitResult.score);

        emitThrowDart({
          aim: aimRef.current,
          score: hitResult.score,
          zone: hitResult.zone,
        });
        throwCountRef.current += 1;
        setThrowsLeft((prev) => Math.max(0, prev - 1));
        if (throwCountRef.current >= 3) {
          setHasFinishedTurn(true);
          setTimeout(() => {
            stopSensors();
          }, 3000);
          return;
        }

        setTimeout(() => {
          if (!sensorsActiveRef.current) return;
          readyRef.current = true;
          armedAtRef.current = performance.now();
          baselineSumRef.current = 0;
          baselineSamplesRef.current = 0;
          prevMagRef.current = 0;
        }, 300);
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
  };
}
