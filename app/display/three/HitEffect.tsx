import { useEffect, useRef, useState, useMemo } from "react";
import type { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color } from "three";
import * as THREE from "three";

interface HitEffectProps {
  position: [number, number, number];
  onComplete?: () => void;
}

// 볼륨 클라우드를 위한 파티클 생성
function createCloudParticles(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // 구 형태로 파티클 분포
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.5 + Math.random() * 1.5;

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  return positions;
}

export default function HitEffect({ position, onComplete }: HitEffectProps) {
  const cloudRef = useRef<Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const [cloudOpacity, setCloudOpacity] = useState(0);
  const [cloudScale, setCloudScale] = useState(0.1);
  const [isDone, setIsDone] = useState(false);
  const timeRef = useRef(0);

  // 클라우드 파티클 데이터
  const cloudParticles = useMemo(() => createCloudParticles(100), []);

  // 애니메이션 타이밍 제어
  useEffect(() => {
    // 클라우드 확장 및 페이드 인
    const cloudGrow = setInterval(() => {
      setCloudOpacity((prev) => Math.min(prev + 0.05, 0.9));
      setCloudScale((prev) => Math.min(prev + 0.08, 1.2));
    }, 16);

    // 클라우드 표시 후 페이드 아웃 (1초 후)
    const fadeOut = setTimeout(() => {
      clearInterval(cloudGrow);
      const fadeOutInterval = setInterval(() => {
        setCloudOpacity((prev) => {
          const next = prev - 0.05;
          if (next <= 0) {
            clearInterval(fadeOutInterval);
            setIsDone(true);
            onComplete?.();
            return 0;
          }
          return next;
        });
      }, 16);
    }, 1000);

    return () => {
      clearInterval(cloudGrow);
      clearTimeout(fadeOut);
    };
  }, [onComplete]);

  // 클라우드 애니메이션 (회전 + 파티클 움직임)
  useFrame((state, delta) => {
    timeRef.current += delta;

    if (cloudRef.current && !isDone) {
      cloudRef.current.rotation.y += delta * 0.5;
      cloudRef.current.rotation.z += delta * 0.3;
    }

    if (particlesRef.current && !isDone) {
      const positions = particlesRef.current.geometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(timeRef.current + i) * 0.002;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (isDone) return null;

  return (
    <group position={position}>
      {/* 3D 볼륨 클라우드 효과 */}
      <group ref={cloudRef} scale={cloudScale}>
        {/* 파티클 기반 볼륨 클라우드 */}
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[cloudParticles, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.6}
            color={new Color(0xffffff)}
            transparent
            opacity={cloudOpacity}
            blending={AdditiveBlending}
            depthWrite={false}
            sizeAttenuation={true}
          />
        </points>

        {/* 볼륨감을 위한 반투명 구체들 */}
        {Array.from({ length: 15 }).map((_, i) => {
          const theta = (i / 15) * Math.PI * 2;
          const phi = Math.acos(2 * (i / 15) - 1);
          const radius = 0.8 + (i % 3) * 0.3;
          const x = radius * Math.sin(phi) * Math.cos(theta);
          const y = radius * Math.sin(phi) * Math.sin(theta);
          const z = radius * Math.cos(phi) * 0.5;
          const scale = 0.4 + (i % 4) * 0.15;

          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[scale, 16, 16]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={cloudOpacity * 0.4}
                emissive="#e0e0ff"
                emissiveIntensity={0.6}
                roughness={0.8}
                metalness={0.1}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}

        {/* 중앙 코어 */}
        <mesh>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={cloudOpacity * 0.6}
            emissive="#ffffff"
            emissiveIntensity={0.8}
            roughness={0.5}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
