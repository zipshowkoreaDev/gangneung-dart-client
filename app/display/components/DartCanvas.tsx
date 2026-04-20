import { Canvas } from "@react-three/fiber";
import Scene from "../three/Scene";
import { DISPLAY_CANVAS_Y_OFFSET } from "@/lib/displayLayout";

// 다트 게임 3D Canvas 컴포넌트
export default function DartCanvas() {
  return (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ transform: `translateY(${DISPLAY_CANVAS_Y_OFFSET * 100}%)` }}
    >
      <Canvas
        camera={{
          position: [0, 0, 50],
          fov: 50,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
