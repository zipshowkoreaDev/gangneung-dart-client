interface GameScreenProps {
  aimPosition: { x: number; y: number };
  throwsLeft: number;
  dartTimeLeft: number;
  sensorsReady: boolean;
  sensorError: string;
  onRequestPermission: () => void;
  onCalibrate: () => void;
}

export default function GameScreen({
  aimPosition,
  throwsLeft,
  dartTimeLeft,
  sensorsReady,
  sensorError,
  onRequestPermission,
  onCalibrate,
}: GameScreenProps) {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center py-4">
      <div className="shrink-0 text-center text-lg font-bold text-white">
        <div>다트 게임</div>
      </div>

      {/* 자이로 조준 패드 */}
      <div className="relative mt-4 h-[min(52dvh,440px)] min-h-[220px] w-[90%] max-w-[500px] shrink rounded-3xl border-[3px] border-white/30 bg-white/10 backdrop-blur-[10px]">
        <div
          className="absolute top-1/2 left-1/2 w-[60px] h-[60px] rounded-full border-4 border-[#FFD700] bg-[#FFD700]/30 pointer-events-none transition-transform duration-[50ms] ease-out"
          style={{
            transform: `translate(calc(-50% + ${aimPosition.x * 45}%), calc(-50% + ${aimPosition.y * 45}%))`,
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-sm opacity-50 pointer-events-none">
          휴대폰을 기울여 조준하세요
        </div>
      </div>

      <div className="mt-4 shrink-0 text-xs text-white opacity-60">
        X: {aimPosition.x.toFixed(2)}, Y: {aimPosition.y.toFixed(2)}
      </div>
      <div className="mt-2 shrink-0 text-sm tracking-[6px] text-white opacity-80">
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
