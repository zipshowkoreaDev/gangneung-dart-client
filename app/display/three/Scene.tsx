"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type HitZone = "bull" | "single" | "triple" | "double" | "miss";

interface HitResult {
  zone: HitZone;
  score: number;
}

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

function getHitResult(distance: number, rouletteRadius: number): HitResult {
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

interface StuckDartProps {
  position: [number, number, number];
}

function StuckDart({ position }: StuckDartProps) {
  const { scene } = useGLTF("/models/dart.glb");

  return (
    <group position={position}>
      <primitive
        object={scene.clone()}
        rotation={[0, 0, -Math.PI / 2]}
        scale={0.4}
      />
    </group>
  );
}

interface FlyingDartProps {
  targetPosition: [number, number, number];
  onComplete: () => void;
}

function FlyingDart({ targetPosition, onComplete }: FlyingDartProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/dart.glb");
  const [progress, setProgress] = useState(0);

  const startPosition: [number, number, number] = [
    targetPosition[0],
    targetPosition[1],
    30, // 카메라 앞쪽에서 시작
  ];

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    setProgress((prev) => {
      const next = prev + delta * 1.5; // 속도 조절
      if (next >= 1) {
        onComplete();
        return 1;
      }
      return next;
    });

    groupRef.current.position.x = THREE.MathUtils.lerp(
      startPosition[0],
      targetPosition[0],
      progress
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      startPosition[1],
      targetPosition[1],
      progress
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      startPosition[2],
      targetPosition[2],
      progress
    );

    groupRef.current.rotation.y += delta * 3;
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={scene.clone()}
        rotation={[0, 0, -Math.PI / 2]}
        scale={0.4}
      />
    </group>
  );
}

interface ThrownDart {
  id: string;
  position: [number, number, number];
  ownerKey: string;
}

interface FlyingDartData {
  id: string;
  position: [number, number, number];
  ownerKey: string;
}

let cachedRouletteRadius = 20;

function RotatingRoulette({
  flyingDarts,
  stuckDarts,
}: {
  flyingDarts: FlyingDartData[];
  stuckDarts: ThrownDart[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/roulette.glb");

  useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    cachedRouletteRadius = Math.max(size.x, size.y) / 2;
  }, [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z -= delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} rotation={[0, -Math.PI / 2, 0]} scale={1} />

      {flyingDarts.map((dart) => (
        <FlyingDart
          key={dart.id}
          targetPosition={dart.position}
          onComplete={() => {}}
        />
      ))}

      {stuckDarts.map((dart) => (
        <StuckDart key={dart.id} position={dart.position} />
      ))}
    </group>
  );
}

export function getRouletteRadius(): number {
  return cachedRouletteRadius;
}

function DartEventHandler({
  onDartThrow,
}: {
  onDartThrow: (position: [number, number, number], ownerKey: string) => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const handleThrow = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;

      if (!data.aim) return;

      const { x, y } = data.aim;

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(x, y);
      raycaster.setFromCamera(mouse, camera);

      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectPoint);

      const ownerKey =
        data.playerId || data.name || data.socketId || "player";
      onDartThrow(
        [intersectPoint.x, intersectPoint.y, intersectPoint.z],
        ownerKey
      );
    };

    window.addEventListener("DART_THROW", handleThrow);
    return () => window.removeEventListener("DART_THROW", handleThrow);
  }, [camera, onDartThrow]);

  return null;
}

export default function Scene() {
  const [flyingDarts, setFlyingDarts] = useState<FlyingDartData[]>([]);
  const [stuckDarts, setStuckDarts] = useState<ThrownDart[]>([]);

  useEffect(() => {
    const handleReset = () => {
      setFlyingDarts([]);
      setStuckDarts([]);
    };
    window.addEventListener("RESET_SCENE", handleReset);
    return () => window.removeEventListener("RESET_SCENE", handleReset);
  }, []);

  useEffect(() => {
    const handleClearPlayerDarts = (event: Event) => {
      const customEvent = event as CustomEvent;
      const key = customEvent.detail?.key as string | undefined;
      if (!key) return;

      setFlyingDarts((prev) => prev.filter((dart) => dart.ownerKey !== key));
      setStuckDarts((prev) => prev.filter((dart) => dart.ownerKey !== key));
    };

    window.addEventListener("CLEAR_PLAYER_DARTS", handleClearPlayerDarts);
    return () =>
      window.removeEventListener("CLEAR_PLAYER_DARTS", handleClearPlayerDarts);
  }, []);

  const handleDartThrow = (
    position: [number, number, number],
    ownerKey: string
  ) => {
    const dartId = `${Date.now()}-${Math.random()}`;

    setFlyingDarts((prev) => [
      ...prev,
      { id: dartId, position, ownerKey },
    ]);

    setTimeout(() => {
      setFlyingDarts((prev) => prev.filter((d) => d.id !== dartId));
      setStuckDarts((prev) => [
        ...prev,
        { id: dartId, position, ownerKey },
      ]);
    }, 700);
  };

  return (
    <>
      {/* DART_THROW 이벤트 핸들러 */}
      <DartEventHandler onDartThrow={handleDartThrow} />

      {/* 기본 조명 - 전체 밝기 */}
      <ambientLight intensity={1.5} color={"white"} />
      <directionalLight position={[-20, 0, 20]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[20, 0, 20]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[0, 20, 15]} intensity={1.5} />

      <RotatingRoulette flyingDarts={flyingDarts} stuckDarts={stuckDarts} />
      <OrbitControls enableZoom={false} />
    </>
  );
}

useGLTF.preload("/models/roulette.glb");
useGLTF.preload("/models/dart.glb");
