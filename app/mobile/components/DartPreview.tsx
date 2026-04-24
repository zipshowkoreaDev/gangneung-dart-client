"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayerSlot } from "@/lib/room";

const DART_MODEL_PATHS: Record<PlayerSlot, string> = {
  1: "/models/dart_blue.glb",
  2: "/models/dart_red.glb",
  3: "/models/dart_green.glb",
  4: "/models/dart_yellow.glb",
};

function DartModel({
  path,
  throwCount,
}: {
  path: string;
  throwCount: number;
}) {
  const { scene } = useGLTF(path);
  const groupRef = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const throwStartedAtRef = useRef<number | null>(null);
  const lastThrowCountRef = useRef(throwCount);

  useEffect(() => {
    if (throwCount <= lastThrowCountRef.current) return;
    lastThrowCountRef.current = throwCount;
    throwStartedAtRef.current = performance.now();
  }, [throwCount]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const elapsed = state.clock.elapsedTime;
    const throwStartedAt = throwStartedAtRef.current;
    let forwardOffset = 0;
    let scaleBoost = 0;

    if (throwStartedAt !== null) {
      const throwElapsed = (performance.now() - throwStartedAt) / 1000;
      const duration = 0.45;
      const progress = Math.min(throwElapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      forwardOffset = THREE.MathUtils.lerp(0, 5.5, eased);
      scaleBoost = THREE.MathUtils.lerp(0, 2.5, eased);

      if (progress >= 1) {
        throwStartedAtRef.current = null;
      }
    }

    groupRef.current.rotation.y = elapsed * 0.8;
    groupRef.current.rotation.x = Math.sin(elapsed * 1.2) * 0.1;
    groupRef.current.position.x = 0;
    groupRef.current.position.y = forwardOffset;
    groupRef.current.position.z = 0;
    groupRef.current.scale.setScalar(18 + scaleBoost);
  });

  return (
    <group ref={groupRef} rotation={[0.25, -0.4, Math.PI]}>
      <primitive object={clonedScene} />
    </group>
  );
}

export default function DartPreview({
  slot,
  throwCount,
}: {
  slot: PlayerSlot | null;
  throwCount: number;
}) {
  const modelPath = slot ? DART_MODEL_PATHS[slot] : DART_MODEL_PATHS[1];

  return (
    <div className="relative mt-4 h-[min(58dvh,480px)] min-h-[260px] w-[90%] max-w-[520px] overflow-hidden">
      <Canvas camera={{ position: [0, 0, 8], fov: 38 }}>
        <ambientLight intensity={1.7} />
        <directionalLight position={[4, 5, 6]} intensity={2.2} />
        <directionalLight position={[-4, -2, 5]} intensity={1.2} color="#9ecbff" />
        <DartModel path={modelPath} throwCount={throwCount} />
      </Canvas>
    </div>
  );
}

Object.values(DART_MODEL_PATHS).forEach((path) => useGLTF.preload(path));
