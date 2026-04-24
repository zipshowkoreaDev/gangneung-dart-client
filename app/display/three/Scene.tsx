"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { aimToCanvasNdc } from "@/lib/displayAimCoordinates";
import { DISPLAY_EVENTS } from "@/lib/displayEvents";
import {
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
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - vec2(0.5, 0.5);
    float radial = length(center);
    float vignette = smoothstep(0.18, 0.78, radial);
    float horizon = smoothstep(0.018, 0.0, abs(vUv.y - 0.56));
    float verticalCore = smoothstep(0.22, 0.0, abs(center.x));
    float portal = smoothstep(0.42, 0.18, abs(radial - 0.24));

    float scan = smoothstep(0.012, 0.0, abs(fract(vUv.y * 58.0) - 0.5));
    float sideBeamA = smoothstep(0.018, 0.0, abs(center.y + center.x * 0.62 + 0.2));
    float sideBeamB = smoothstep(0.018, 0.0, abs(center.y - center.x * 0.62 + 0.2));
    float sidePanels = smoothstep(0.012, 0.0, abs(abs(center.x) - 0.32));

    vec3 deep = vec3(0.006, 0.018, 0.075);
    vec3 navy = vec3(0.015, 0.055, 0.18);
    vec3 blue = vec3(0.055, 0.22, 0.72);
    vec3 cyan = vec3(0.2, 0.84, 1.0);

    vec3 color = deep;
    color = mix(color, navy, (1.0 - vUv.y) * 0.44);
    color += blue * verticalCore * 0.22;
    color += blue * portal * 0.24;
    color += cyan * horizon * 0.22;
    color += blue * (sideBeamA + sideBeamB) * 0.11;
    color += cyan * sidePanels * 0.08;
    color += cyan * scan * 0.012;
    color = mix(color, deep * 0.72, vignette * 0.52);

    gl_FragColor = vec4(color, 1.0);
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
function FlyingDart({
  targetPosition,
  modelPath,
}: FlyingDartProps) {
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

  return (
    <mesh position={[0, 0, BACKDROP_PLANE_Z]} renderOrder={-10}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        vertexShader={BACKDROP_VERTEX_SHADER}
        fragmentShader={BACKDROP_FRAGMENT_SHADER}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
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
    return () => window.removeEventListener(DISPLAY_EVENTS.dartThrow, handleThrow);
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

    window.addEventListener(DISPLAY_EVENTS.syncPlayerDarts, handleSyncPlayerDarts);
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
    return () => window.removeEventListener(DISPLAY_EVENTS.resetScene, handleReset);
  }, []);

  useEffect(() => {
    const handleClearPlayerDarts = (event: Event) => {
      const customEvent = event as CustomEvent;
      const key = customEvent.detail?.key as string | undefined;
      if (!key) return;

      setFlyingDarts((prev) => prev.filter((dart) => dart.ownerKey !== key));
      setStuckDarts((prev) => prev.filter((dart) => dart.ownerKey !== key));
    };

    window.addEventListener(DISPLAY_EVENTS.clearPlayerDarts, handleClearPlayerDarts);
    return () =>
      window.removeEventListener(DISPLAY_EVENTS.clearPlayerDarts, handleClearPlayerDarts);
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
