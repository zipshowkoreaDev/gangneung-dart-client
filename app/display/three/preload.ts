import { useGLTF } from "@react-three/drei";

export function preloadModels() {
  useGLTF.preload("/test/model_1.glb");
}
