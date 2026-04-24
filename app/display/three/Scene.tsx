"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { aimToCanvasNdc } from "@/lib/displayAimCoordinates";
import { DISPLAY_EVENTS } from "@/lib/displayEvents";
import {
  getRouletteRadius,
  SCORE_MEASUREMENT_CENTER,
  setRouletteRadius,
} from "./scoreMeasurement";

// Scene constants
const DART_MODEL_SCALE = 24;
const ROULETTE_MODEL_SCALE = 12;
const BACKDROP_PLANE_Z = -14;
const BACKDROP_PLANE_SCALE = 1.08;
const DART_MODEL_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];
const DART_FLIGHT_DURATION_MS = 700;
const DART_MODEL_PATHS = [
  "/models/dart_blue.glb",
  "/models/dart_red.glb",
  "/models/dart_green.glb",
  "/models/dart_yellow.glb",
] as const;

// Backdrop shaders
const BACKDROP_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BACKDROP_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vUv;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float gridLine(float value, float width) {
    return smoothstep(width, 0.0, abs(fract(value) - 0.5));
  }

  float hexSdf(vec2 p) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735026);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z, k.z), 1.0);
    return length(p) * sign(p.y);
  }

  float hexOutline(vec2 p, float radius, float thickness) {
    float d = hexSdf(p / radius) * radius;
    return smoothstep(thickness, 0.0, abs(d));
  }

  float hexGlow(vec2 p, float radius, float width) {
    float d = abs(hexSdf(p / radius) * radius);
    return smoothstep(width, 0.0, d);
  }

  vec2 hexCenter(vec2 cell) {
    return vec2(cell.x * 0.8660254, cell.y + mod(cell.x, 2.0) * 0.5);
  }

  vec2 nearestHexCell(vec2 p) {
    vec2 base = vec2(floor(p.x / 0.8660254), floor(p.y));
    vec2 bestCell = base;
    float bestDistance = 1e9;

    for (int ix = -1; ix <= 1; ix++) {
      for (int iy = -1; iy <= 1; iy++) {
        vec2 candidate = base + vec2(float(ix), float(iy));
        vec2 center = hexCenter(candidate);
        float distanceToCenter = length(p - center);
        if (distanceToCenter < bestDistance) {
          bestDistance = distanceToCenter;
          bestCell = candidate;
        }
      }
    }

    return bestCell;
  }

  vec2 offsetToAxial(vec2 cell) {
    float q = cell.x;
    float r = cell.y - floor((cell.x - mod(cell.x, 2.0)) * 0.5);
    return vec2(q, r);
  }

  float hexDistance(vec2 a, vec2 b) {
    vec2 aa = offsetToAxial(a);
    vec2 bb = offsetToAxial(b);
    vec2 d = aa - bb;
    float dz = abs(d.x + d.y);
    return (abs(d.x) + abs(d.y) + dz) * 0.5;
  }

  float hexLayer(
    vec2 uv,
    float scale,
    vec2 drift,
    float radius,
    float thickness,
    float threshold,
    float clusterSize
  ) {
    // 벌집 군집 생성부:
    // main()에서 이 레이어 호출을 지우면 해당 육각형 군집이 사라집니다.
    // threshold / clusterSize를 조절하면 군집 밀도와 묶이는 크기가 바뀝니다.
    vec2 p = uv * scale + drift * uTime;
    vec2 cell = nearestHexCell(p);
    vec2 local = p - hexCenter(cell);
    vec2 clusterCell = floor((cell + vec2(1.0, 1.0)) / clusterSize);
    vec2 localCluster = cell - clusterCell * clusterSize;

    // threshold:
    // 값을 높이면 군집이 적게 나오고, 낮추면 더 많이 나옵니다.
    float cluster = step(threshold, hash21(clusterCell + scale));
    vec2 centerA = vec2(
      1.0 + floor(hash21(clusterCell + 1.7) * max(clusterSize - 2.0, 1.0)),
      1.0 + floor(hash21(clusterCell + 4.1) * max(clusterSize - 2.0, 1.0))
    );
    vec2 centerB = centerA + vec2(
      hash21(clusterCell + 8.3) > 0.5 ? 1.0 : -1.0,
      hash21(clusterCell + 11.9) > 0.5 ? 1.0 : 0.0
    );
    vec2 centerC = centerA + vec2(
      0.0,
      hash21(clusterCell + 14.6) > 0.55 ? -1.0 : 1.0
    );
    vec2 centerD = centerB + vec2(
      hash21(clusterCell + 24.8) > 0.5 ? 1.0 : -1.0,
      hash21(clusterCell + 27.1) > 0.5 ? 1.0 : -1.0
    );

    float groupA = step(hexDistance(localCluster, centerA), 1.0);
    float groupB = step(hexDistance(localCluster, centerB), 1.0);
    float groupC = step(hexDistance(localCluster, centerC), 1.0) *
      step(0.58, hash21(clusterCell + 18.2));
    float groupD = step(hexDistance(localCluster, centerD), 1.0) *
      step(0.68, hash21(clusterCell + 22.5));
    // core / groupA-D:
    // 한 군집 안에 몇 개의 육각형이 연결될지 결정하는 부분입니다.
    float core = step(hexDistance(localCluster, centerA), 2.0);
    float member = clamp(core + groupB + groupC + groupD, 0.0, 1.0);
    float intensity = 0.6 + 0.4 * hash21(cell + 9.7);
    float pulse =
      0.72 +
      0.28 * sin(uTime * (0.55 + hash21(clusterCell + 6.3)) + hash21(cell) * 6.2831);

    // radius / thickness:
    // radius는 육각형 크기와 간격, thickness는 보더 두께를 조절합니다.
    float outer = hexOutline(local, radius, thickness);
    float glow = hexGlow(local, radius, thickness * 4.8);

    return cluster * member * (outer + glow * 0.4) * intensity * pulse;
  }

  void main() {
    vec2 rawUv = vUv;
    vec2 uv = vec2((vUv.x - 0.5) * uAspect + 0.5, vUv.y);
    vec2 center = uv - vec2(0.5, 0.5);
    float radial = length(center);
    float vignette = smoothstep(0.22, 0.86, radial);

    float horizontalBands =
      gridLine(uv.y * 4.4 - uTime * 0.015, 0.015) * 0.85 +
      gridLine(uv.y * 8.0 + uTime * 0.02, 0.022) * 0.3;
    float verticalBands =
      gridLine(uv.x * 3.2 + uTime * 0.01, 0.018) * 0.5 +
      gridLine(uv.x * 6.5 - uTime * 0.016, 0.012) * 0.18;
    float centerAura = smoothstep(0.72, 0.06, radial);
    float topBloom = smoothstep(0.38, 0.0, length(uv - vec2(0.52, 0.2)));
    float lowerBloom = smoothstep(0.55, 0.0, length(uv - vec2(0.5, 0.92)));
    float centerColumn = smoothstep(0.06, 0.0, abs(uv.x - 0.18)) * 0.12;
    float rightColumn = smoothstep(0.05, 0.0, abs(uv.x - 0.82)) * 0.08;
    float depthFog = smoothstep(0.0, 0.9, uv.y);
    float panelGlow = smoothstep(0.7, 0.0, abs(uv.y - 0.54)) * 0.08;
    float softScan =
      smoothstep(0.08, 0.0, abs(fract(uv.y * 1.8 - uTime * 0.035) - 0.5)) * 0.045;

    vec2 topLeftAnchor = vec2(-0.08, 0.2);
    vec2 topRightAnchor = vec2(1.0, 0.24);
    vec2 midLeftAnchor = vec2(0.18, 0.58);
    vec2 bottomRightAnchor = vec2(0.74, 0.74);

    vec2 topLeftLocal = vec2((rawUv.x - topLeftAnchor.x) * uAspect, rawUv.y - topLeftAnchor.y);
    vec2 topRightLocal = vec2((rawUv.x - topRightAnchor.x) * uAspect, rawUv.y - topRightAnchor.y);
    vec2 midLeftLocal = vec2((rawUv.x - midLeftAnchor.x) * uAspect, rawUv.y - midLeftAnchor.y);
    vec2 bottomRightLocal = vec2(
      (rawUv.x - bottomRightAnchor.x) * uAspect,
      rawUv.y - bottomRightAnchor.y
    );

    // 육각형 군집 레이어 설정:
    // 4개 군집을 화면 좌표 기준으로 직접 배치합니다.
    float clusterTopLeft = hexLayer(
      topLeftLocal * 1.75 + vec2(0.5, 0.5),
      13.6,
      vec2(0.012, -0.03),
      0.48,
      0.014,
      0.58,
      5.4
    ) * (1.0 - smoothstep(0.0, 0.26, length(topLeftLocal)));
    float clusterTopRight = hexLayer(
      topRightLocal * 1.67 + vec2(0.5, 0.5),
      13.2,
      vec2(-0.008, -0.02),
      0.475,
      0.013,
      0.6,
      5.4
    ) * (1.0 - smoothstep(0.0, 0.24, length(topRightLocal)));
    float clusterMidLeft = hexLayer(
      midLeftLocal * 1.79 + vec2(0.5, 0.5),
      13.8,
      vec2(0.01, -0.018),
      0.48,
      0.014,
      0.59,
      5.8
    ) * (1.0 - smoothstep(0.0, 0.27, length(midLeftLocal)));
    float clusterBottomRight = hexLayer(
      bottomRightLocal * 1.71 + vec2(0.5, 0.5),
      13.0,
      vec2(0.004, -0.01),
      0.47,
      0.012,
      0.62,
      5.8
    ) * (1.0 - smoothstep(0.0, 0.25, length(bottomRightLocal)));

    float clusterTopLeftPulse =
      0.88 + 0.12 * sin(uTime * 1.35 + topLeftLocal.y * 7.0 + topLeftLocal.x * 2.0);
    float clusterTopRightPulse =
      0.86 + 0.14 * sin(uTime * 1.18 + topRightLocal.x * 6.4 + 1.1);
    float clusterMidLeftPulse =
      0.87 + 0.13 * sin(uTime * 1.46 + (midLeftLocal.x + midLeftLocal.y) * 5.8 + 0.5);
    float clusterBottomRightPulse =
      0.85 +
      0.15 * sin(uTime * 1.22 + (bottomRightLocal.x - bottomRightLocal.y) * 6.2 + 1.8);

    clusterTopLeft *= clusterTopLeftPulse;
    clusterTopRight *= clusterTopRightPulse;
    clusterMidLeft *= clusterMidLeftPulse;
    clusterBottomRight *= clusterBottomRightPulse;

    float clusterSweep =
      smoothstep(0.12, 0.0, abs(fract(rawUv.y * 2.0 - uTime * 0.085) - 0.5)) * 0.05;
    float clusterSweepMask = clusterTopLeft + clusterTopRight + clusterMidLeft + clusterBottomRight;

    float topLeftFlow =
      smoothstep(0.18, 0.0, abs(fract((topLeftLocal.x + topLeftLocal.y) * 2.8 - uTime * 0.42) - 0.5));
    float topRightFlow =
      smoothstep(0.18, 0.0, abs(fract((topRightLocal.x - topRightLocal.y) * 2.6 - uTime * 0.4) - 0.5));
    float midLeftFlow =
      smoothstep(0.18, 0.0, abs(fract((midLeftLocal.y * 2.4 + midLeftLocal.x) - uTime * 0.38) - 0.5));
    float bottomRightFlow =
      smoothstep(0.18, 0.0, abs(fract((bottomRightLocal.x * 2.2 - bottomRightLocal.y) - uTime * 0.36) - 0.5));

    float clusterFlow =
      clusterTopLeft * topLeftFlow * 0.42 +
      clusterTopRight * topRightFlow * 0.38 +
      clusterMidLeft * midLeftFlow * 0.4 +
      clusterBottomRight * bottomRightFlow * 0.36;

    float clusterSparkle =
      smoothstep(
        0.985,
        1.0,
        hash21(floor(rawUv * vec2(26.0, 16.0)) + floor(uTime * 2.2))
      ) * clusterSweepMask * 0.08;

    vec3 deep = vec3(0.004, 0.012, 0.045);
    vec3 navy = vec3(0.012, 0.045, 0.16);
    vec3 blue = vec3(0.04, 0.18, 0.58);
    vec3 cyan = vec3(0.18, 0.84, 1.0);
    vec3 pale = vec3(0.62, 0.98, 1.0);

    vec3 color = mix(deep, navy, 1.0 - uv.y);
    color += blue * centerAura * 0.22;
    color += blue * topBloom * 0.12;
    color += navy * lowerBloom * 0.1;
    color += cyan * horizontalBands * 0.12;
    color += cyan * verticalBands * 0.07;
    color += blue * panelGlow;
    color += cyan * softScan;
    color += cyan * clusterSweep * clusterSweepMask * 0.18;
    color += cyan * clusterFlow * 0.3;
    color += pale * clusterFlow * 0.08;
    color += pale * clusterSparkle;
    color += blue * (centerColumn + rightColumn);
    // 최종 군집 색 반영부:
    // clusterTopLeft / clusterTopRight / clusterMidLeft / clusterBottomRight
    // 값을 줄이거나 지우면 해당 위치 군집만 약해지거나 사라집니다.
    color += blue * clusterBottomRight * 0.26;
    color += cyan * clusterBottomRight * 0.24;
    color += blue * clusterMidLeft * 0.28;
    color += cyan * clusterMidLeft * 0.25;
    color += blue * clusterTopRight * 0.3;
    color += cyan * clusterTopRight * 0.3;
    color += blue * clusterTopLeft * 0.3;
    color += cyan * clusterTopLeft * 0.35;
    color += pale * clusterTopLeft * 0.1;
    color = mix(color, navy, depthFog * 0.12);
    color = mix(color, deep * 0.8, vignette * 0.48);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const OUTER_GLOW_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const OUTER_GLOW_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uRimRadius;
  varying vec2 vUv;

  void main() {
    vec2 centeredUv = (vUv - 0.5) * 2.0;
    float radial = length(centeredUv);
    float rimDistance = abs(radial - uRimRadius);
    float angle = atan(centeredUv.y, centeredUv.x);

    float broadHalo = 1.0 - smoothstep(0.014, 0.05, rimDistance);
    float rimGlow = 1.0 - smoothstep(0.0025, 0.012, rimDistance);
    float outerMist = 1.0 - smoothstep(0.024, 0.07, rimDistance);
    float rotatingSweep =
      smoothstep(
        0.16,
        0.0,
        abs(fract((angle / 6.2831853) * 2.0 - uTime * 0.16) - 0.5)
      );
    float secondarySweep =
      smoothstep(
        0.14,
        0.0,
        abs(fract((angle / 6.2831853) * 1.4 + uTime * 0.11 + 0.25) - 0.5)
      );

    float pulse = 0.96 + sin(uTime * 1.2) * 0.04;
    float shimmer = 0.92 + sin(uTime * 1.7 + radial * 10.0) * 0.08;

    vec3 deepBlue = vec3(0.08, 0.24, 0.92);
    vec3 cyan = vec3(0.22, 0.88, 1.0);

    vec3 color = deepBlue * broadHalo * 0.42;
    color += cyan * rimGlow * 0.5 * shimmer;
    color += deepBlue * outerMist * 0.1;
    color += cyan * rimGlow * rotatingSweep * 0.42;
    color += vec3(0.5, 0.96, 1.0) * broadHalo * secondarySweep * 0.18;

    float alpha = broadHalo * 0.1 * pulse + rimGlow * 0.2 * shimmer + outerMist * 0.024;
    alpha *= 1.0 - smoothstep(0.075, 0.11, rimDistance);
    alpha += rimGlow * rotatingSweep * 0.08 + broadHalo * secondarySweep * 0.03;

    gl_FragColor = vec4(color, alpha);
  }
`;

// Shared scene types
interface StuckDartProps {
  position: [number, number, number];
  modelPath: string;
}

interface FlyingDartProps {
  targetPosition: [number, number, number];
  modelPath: string;
}

interface ThrownDart {
  id: string;
  position: [number, number, number];
  ownerKey: string;
  modelPath: string;
}

interface FlyingDartData {
  id: string;
  position: [number, number, number];
  ownerKey: string;
  modelPath: string;
}

// Small scene helpers
function getDartModelPath(ownerKey: string) {
  const slotMatch = ownerKey.match(/^slot-([1-4])$/);
  const slotIndex = slotMatch ? Number(slotMatch[1]) - 1 : 0;
  return DART_MODEL_PATHS[slotIndex] ?? DART_MODEL_PATHS[0];
}

function createDartId() {
  return `${Date.now()}-${Math.random()}`;
}

function aimToBoardPosition(
  aim: { x: number; y: number },
  camera: THREE.Camera,
): [number, number, number] | null {
  const { x, y } = aimToCanvasNdc(aim);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(x, y);
  raycaster.setFromCamera(mouse, camera);

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1);
  const intersectPoint = new THREE.Vector3();
  const hasIntersection = raycaster.ray.intersectPlane(plane, intersectPoint);
  if (!hasIntersection) return null;

  return [intersectPoint.x, intersectPoint.y, intersectPoint.z];
}

// Static dart mesh already stuck on the board
function StuckDart({ position, modelPath }: StuckDartProps) {
  const { scene } = useGLTF(modelPath);

  return (
    <group position={position}>
      <primitive
        object={scene.clone()}
        rotation={DART_MODEL_ROTATION}
        scale={DART_MODEL_SCALE}
      />
    </group>
  );
}

// Animated dart travelling toward the board
function FlyingDart({ targetPosition, modelPath }: FlyingDartProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);
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
      if (next >= 1) return 1;
      return next;
    });

    groupRef.current.position.x = THREE.MathUtils.lerp(
      startPosition[0],
      targetPosition[0],
      progress,
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      startPosition[1],
      targetPosition[1],
      progress,
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      startPosition[2],
      targetPosition[2],
      progress,
    );
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={scene.clone()}
        rotation={DART_MODEL_ROTATION}
        scale={DART_MODEL_SCALE}
      />
    </group>
  );
}

// Full-screen 3D backdrop behind the roulette
function DepthBackdrop() {
  const { camera, size } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { width, height } = useMemo(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const distance = perspectiveCamera.position.z - BACKDROP_PLANE_Z;
    const fov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const planeHeight = 2 * Math.tan(fov / 2) * distance;
    const planeWidth = planeHeight * (size.width / size.height);

    return {
      width: planeWidth * BACKDROP_PLANE_SCALE,
      height: planeHeight * BACKDROP_PLANE_SCALE,
    };
  }, [camera, size.height, size.width]);

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uAspect.value = size.width / size.height;
  });

  return (
    <mesh position={[0, 0, BACKDROP_PLANE_Z]} renderOrder={-10}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={BACKDROP_VERTEX_SHADER}
        fragmentShader={BACKDROP_FRAGMENT_SHADER}
        uniforms={{
          uTime: { value: 0 },
          uAspect: { value: size.width / size.height },
        }}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function RouletteOuterGlow() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const radius = getRouletteRadius();

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group position={[SCORE_MEASUREMENT_CENTER[0], SCORE_MEASUREMENT_CENTER[1], -0.55]}>
      <mesh renderOrder={-2}>
        <planeGeometry args={[radius * 2.12, radius * 2.12]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={OUTER_GLOW_VERTEX_SHADER}
          fragmentShader={OUTER_GLOW_FRAGMENT_SHADER}
          uniforms={{
            uTime: { value: 0 },
            uRimRadius: { value: 0.985 },
          }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Roulette model and cached radius measurement
function Roulette() {
  const { scene } = useGLTF("/models/roulette.glb");
  const rouletteScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(rouletteScene);
    const size = box.getSize(new THREE.Vector3());
    setRouletteRadius((Math.max(size.x, size.y) / 2) * ROULETTE_MODEL_SCALE);
  }, [rouletteScene]);

  return (
    <group position={SCORE_MEASUREMENT_CENTER} scale={ROULETTE_MODEL_SCALE}>
      <primitive object={rouletteScene} />
    </group>
  );
}

// Converts throw events into world-space dart targets
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
      const boardPosition = aimToBoardPosition(data.aim, camera);
      if (!boardPosition) return;

      const ownerKey = data.playerId || data.name || data.socketId || "player";
      onDartThrow(boardPosition, ownerKey);
    };

    window.addEventListener(DISPLAY_EVENTS.dartThrow, handleThrow);
    return () =>
      window.removeEventListener(DISPLAY_EVENTS.dartThrow, handleThrow);
  }, [camera, onDartThrow]);

  return null;
}

function SyncPlayerDartsHandler({
  onSyncPlayerDarts,
}: {
  onSyncPlayerDarts: (
    ownerKey: string,
    positions: [number, number, number][],
  ) => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const handleSyncPlayerDarts = (event: Event) => {
      const customEvent = event as CustomEvent;
      const key = customEvent.detail?.key as string | undefined;
      const aims = customEvent.detail?.aims as
        | Array<{ x: number; y: number }>
        | undefined;
      if (!key || !Array.isArray(aims)) return;

      const positions = aims
        .map((aim) => aimToBoardPosition(aim, camera))
        .filter(
          (position): position is [number, number, number] => position !== null,
        );

      onSyncPlayerDarts(key, positions);
    };

    window.addEventListener(
      DISPLAY_EVENTS.syncPlayerDarts,
      handleSyncPlayerDarts,
    );
    return () =>
      window.removeEventListener(
        DISPLAY_EVENTS.syncPlayerDarts,
        handleSyncPlayerDarts,
      );
  }, [camera, onSyncPlayerDarts]);

  return null;
}

// Scene composition and local dart state
export default function Scene() {
  const [flyingDarts, setFlyingDarts] = useState<FlyingDartData[]>([]);
  const [stuckDarts, setStuckDarts] = useState<ThrownDart[]>([]);

  useEffect(() => {
    const handleReset = () => {
      setFlyingDarts([]);
      setStuckDarts([]);
    };
    window.addEventListener(DISPLAY_EVENTS.resetScene, handleReset);
    return () =>
      window.removeEventListener(DISPLAY_EVENTS.resetScene, handleReset);
  }, []);

  useEffect(() => {
    const handleClearPlayerDarts = (event: Event) => {
      const customEvent = event as CustomEvent;
      const key = customEvent.detail?.key as string | undefined;
      if (!key) return;

      setFlyingDarts((prev) => prev.filter((dart) => dart.ownerKey !== key));
      setStuckDarts((prev) => prev.filter((dart) => dart.ownerKey !== key));
    };

    window.addEventListener(
      DISPLAY_EVENTS.clearPlayerDarts,
      handleClearPlayerDarts,
    );
    return () =>
      window.removeEventListener(
        DISPLAY_EVENTS.clearPlayerDarts,
        handleClearPlayerDarts,
      );
  }, []);

  const handleDartThrow = (
    position: [number, number, number],
    ownerKey: string,
  ) => {
    const dartId = createDartId();
    const modelPath = getDartModelPath(ownerKey);

    setFlyingDarts((prev) => [
      ...prev,
      { id: dartId, position, ownerKey, modelPath },
    ]);

    setTimeout(() => {
      setFlyingDarts((prev) => prev.filter((d) => d.id !== dartId));
      setStuckDarts((prev) => [
        ...prev,
        { id: dartId, position, ownerKey, modelPath },
      ]);
    }, DART_FLIGHT_DURATION_MS);
  };

  const handleSyncPlayerDarts = (
    ownerKey: string,
    positions: [number, number, number][],
  ) => {
    const modelPath = getDartModelPath(ownerKey);

    setFlyingDarts((prev) => prev.filter((dart) => dart.ownerKey !== ownerKey));
    setStuckDarts((prev) => [
      ...prev.filter((dart) => dart.ownerKey !== ownerKey),
      ...positions.map((position, index) => ({
        id: `sync-${ownerKey}-${index}`,
        position,
        ownerKey,
        modelPath,
      })),
    ]);
  };

  return (
    <>
      <DepthBackdrop />
      <RouletteOuterGlow />
      <DartEventHandler onDartThrow={handleDartThrow} />
      <SyncPlayerDartsHandler onSyncPlayerDarts={handleSyncPlayerDarts} />

      <ambientLight intensity={1.5} color={"white"} />
      <directionalLight
        position={[-20, 0, 20]}
        intensity={1.5}
        color="#ffffff"
      />
      <directionalLight
        position={[20, 0, 20]}
        intensity={1.5}
        color="#ffffff"
      />
      <directionalLight position={[0, 20, 15]} intensity={1.5} />

      <Roulette />
      {flyingDarts.map((dart) => (
        <FlyingDart
          key={dart.id}
          targetPosition={dart.position}
          modelPath={dart.modelPath}
        />
      ))}

      {stuckDarts.map((dart) => (
        <StuckDart
          key={dart.id}
          position={dart.position}
          modelPath={dart.modelPath}
        />
      ))}
    </>
  );
}

// Preload frequently used models for smoother first throw
useGLTF.preload("/models/roulette.glb");
DART_MODEL_PATHS.forEach((path) => useGLTF.preload(path));
