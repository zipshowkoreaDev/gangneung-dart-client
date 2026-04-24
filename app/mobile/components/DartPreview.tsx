"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayerSlot } from "@/lib/room";

const DART_MODEL_PATHS: Record<PlayerSlot, string> = {
  1: "/models/dart_blue.glb",
  2: "/models/dart_red.glb",
  3: "/models/dart_green.glb",
  4: "/models/dart_yellow.glb",
};

function DartModel({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  const groupRef = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.2) * 0.1;
  });

  return (
    <group ref={groupRef} rotation={[0.25, -0.4, 0]}>
      <primitive object={clonedScene} scale={18} />
    </group>
  );
}

export default function DartPreview({ slot }: { slot: PlayerSlot | null }) {
  const modelPath = slot ? DART_MODEL_PATHS[slot] : DART_MODEL_PATHS[1];

  return (
    <div className="relative mt-4 h-[min(58dvh,480px)] min-h-[260px] w-[90%] max-w-[520px] overflow-hidden rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_rgba(255,255,255,0.04)_42%,_rgba(7,13,34,0.9)_100%)] shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
      <Canvas camera={{ position: [0, 0, 8], fov: 38 }}>
        <ambientLight intensity={1.7} />
        <directionalLight position={[4, 5, 6]} intensity={2.2} />
        <directionalLight position={[-4, -2, 5]} intensity={1.2} color="#9ecbff" />
        <DartModel path={modelPath} />
      </Canvas>
    </div>
  );
}

Object.values(DART_MODEL_PATHS).forEach((path) => useGLTF.preload(path));
