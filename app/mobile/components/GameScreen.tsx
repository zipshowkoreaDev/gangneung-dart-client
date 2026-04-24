import type { PlayerSlot } from "@/lib/room";
import DartPreview from "./DartPreview";

interface GameScreenProps {
  slot: PlayerSlot | null;
  throwsLeft: number;
  dartTimeLeft: number;
  sensorsReady: boolean;
  sensorError: string;
  onRequestPermission: () => void;
  onCalibrate: () => void;
}

export default function GameScreen({
  slot,
  throwsLeft,
  dartTimeLeft,
  sensorsReady,
  sensorError,
  onRequestPermission,
  onCalibrate,
}: GameScreenProps) {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center py-4">
      <DartPreview slot={slot} />

      <div className="mt-5 shrink-0 text-sm tracking-[6px] text-white opacity-80">
        {Array.from({ length: 3 }).map((_, index) => (
          <span
            key={index}
            className={index < throwsLeft ? "opacity-100" : "opacity-20"}
          >
            O
          </span>
        ))}
      </div>
      <div
        className={[
          "mt-3 shrink-0 rounded-full px-4 py-2 text-sm font-bold",
          dartTimeLeft <= 3
            ? "bg-[#ff3b30]/25 text-[#ffdddd]"
            : "bg-white/15 text-white",
        ].join(" ")}
      >
        남은 시간 {dartTimeLeft}초
      </div>

      <button
        onClick={onCalibrate}
        className="mt-4 shrink-0 cursor-pointer rounded-full border-none bg-white/20 px-5 py-3 text-sm font-semibold text-white"
      >
        조준 영점 조절
      </button>

      {!sensorsReady && (
        <button
          onClick={onRequestPermission}
          className="mt-3 shrink-0 cursor-pointer rounded-full border-none bg-white/20 px-5 py-3 text-sm font-semibold text-white"
        >
          자이로 권한 다시 요청
        </button>
      )}

      {sensorError && (
        <div className="mt-2.5 text-[#ffdddd] text-xs opacity-80">
          {sensorError}
        </div>
      )}
    </div>
  );
}
