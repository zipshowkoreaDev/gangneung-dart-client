"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface DartModelProps {
  show: boolean;
  throwing: boolean;
}

function DartModel({ show, throwing }: DartModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/dart.glb");

  // props로부터 target 값 계산 (state 대신 직접 계산)
  const getTargetValues = () => {
    if (throwing) {
      // 던지기: 앞으로 날아가면서 위로 올라감
      return {
        targetY: 2,
        targetZ: -10,
        targetRotationX: -Math.PI / 4,
      };
    } else if (show) {
      // 정상 위치
      return {
        targetY: 0.2,
        targetZ: 0,
        targetRotationX: 0,
      };
    } else {
      // 숨김 위치
      return {
        targetY: -3,
        targetZ: 0,
        targetRotationX: 0,
      };
    }
  };

  const { targetY, targetZ, targetRotationX } = getTargetValues();

  // 세로 축(Y)로 계속 회전 + 위치 애니메이션
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Y축 회전 (던질 때는 더 빠르게)
    const rotationSpeed = throwing ? 3 : 0.5;
    groupRef.current.rotation.y += delta * rotationSpeed;

    // 부드러운 위치 이동 (lerp)
    const speed = throwing ? 8 : 3; // 던질 때 더 빠르게
    const currentY = groupRef.current.position.y;
    const currentZ = groupRef.current.position.z;
    const currentRotX = groupRef.current.rotation.x;

    groupRef.current.position.y = THREE.MathUtils.lerp(
      currentY,
      targetY,
      delta * speed
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      currentZ,
      targetZ,
      delta * speed
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      currentRotX,
      targetRotationX,
      delta * speed
    );

    void state; // ESLint unused var 해결
  });

  return (
    <group ref={groupRef} position={[0, -3, 0]}>
      <primitive object={scene} rotation={[0, 0, -Math.PI / 2]} scale={0.4} />
    </group>
  );
}

interface DartPreviewProps {
  show: boolean;
  throwing: boolean;
}

export default function DartPreview({ show, throwing }: DartPreviewProps) {
  return (
    <Suspense fallback={null}>
      {/* 라이트는 최소만 */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.0} />
      <DartModel show={show} throwing={throwing} />
    </Suspense>
  );
}

// drei GLTF 캐시 프리로드(선택)
useGLTF.preload("/models/dart.glb");
