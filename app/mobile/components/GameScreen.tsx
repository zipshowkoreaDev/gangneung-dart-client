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
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white text-lg font-bold text-center">
        <div>다트 게임</div>
      </div>

      {/* 자이로 조준 패드 */}
      <div className="w-[90%] max-w-[500px] h-[60vh] bg-white/10 rounded-3xl border-[3px] border-white/30 relative backdrop-blur-[10px]">
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

      <div className="mt-5 text-white text-xs opacity-60">
        X: {aimPosition.x.toFixed(2)}, Y: {aimPosition.y.toFixed(2)}
      </div>
      <div className="mt-2 text-white text-sm opacity-80 tracking-[6px]">
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
          "mt-3 rounded-full px-4 py-2 text-sm font-bold",
          dartTimeLeft <= 3
            ? "bg-[#ff3b30]/25 text-[#ffdddd]"
            : "bg-white/15 text-white",
        ].join(" ")}
      >
        남은 시간 {dartTimeLeft}초
      </div>

      <button
        onClick={onCalibrate}
        className="mt-4 px-5 py-3 text-sm font-semibold rounded-full border-none bg-white/20 text-white cursor-pointer"
      >
        조준 영점 조절
      </button>

      {!sensorsReady && (
        <button
          onClick={onRequestPermission}
          className="mt-3 px-5 py-3 text-sm font-semibold rounded-full border-none bg-white/20 text-white cursor-pointer"
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
