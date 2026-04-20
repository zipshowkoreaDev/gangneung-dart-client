import { useEffect, useState } from "react";

export default function Explosion() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(true);
      setTimeout(() => setVisible(false), 300);
    };

    window.addEventListener("EXPLODE", handler);
    return () => window.removeEventListener("EXPLODE", handler);
  }, []);

  if (!visible) return null;

  return (
    <mesh>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}
