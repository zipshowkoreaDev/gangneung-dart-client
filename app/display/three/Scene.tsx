"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { aimToCanvasNdc } from "@/lib/displayAimCoordinates";

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

function Roulette({
  flyingDarts,
  stuckDarts,
}: {
  flyingDarts: FlyingDartData[];
  stuckDarts: ThrownDart[];
}) {
  const { scene } = useGLTF("/models/roulette.glb");
  const rouletteScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(rouletteScene);
    const size = box.getSize(new THREE.Vector3());
    cachedRouletteRadius = Math.max(size.x, size.y) / 2;
  }, [rouletteScene]);

  return (
    <group>
      <primitive object={rouletteScene} rotation={[0, -Math.PI / 2, 0]} />

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

      const { x, y } = aimToCanvasNdc(data.aim);

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
      <DartEventHandler onDartThrow={handleDartThrow} />

      <ambientLight intensity={1.5} color={"white"} />
      <directionalLight position={[-20, 0, 20]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[20, 0, 20]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[0, 20, 15]} intensity={1.5} />

      <Roulette flyingDarts={flyingDarts} stuckDarts={stuckDarts} />
    </>
  );
}

useGLTF.preload("/models/roulette.glb");
useGLTF.preload("/models/dart.glb");
