interface ResultScreenProps {
  name: string;
  score: number;
  onExit: () => void;
  countdown?: number | null;
  serverResult?: {
    result: "win" | "lose" | "tie";
    rank: number;
    totalPlayers: number;
  } | null;
}

// 게임 결과 화면 (내 점수 표시)
export default function ResultScreen({
  name,
  score,
  onExit,
  countdown,
  serverResult,
}: ResultScreenProps) {
  const resultLabel =
    serverResult?.result === "win"
      ? "승리"
      : serverResult?.result === "lose"
        ? "패배"
        : serverResult?.result === "tie"
          ? "무승부"
          : null;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-[28px] font-bold text-white text-center">
        게임 완료!
      </div>

      <div className="w-full max-w-[320px] bg-white/10 rounded-3xl border border-white/20 p-8 backdrop-blur-sm">
        <div className="text-center text-white/70 text-lg mb-2">
          {name}
        </div>
        <div className="text-center">
          <span className="text-6xl font-bold text-[#FFD700]">{score}점</span>
        </div>
        {serverResult && (
          <div className="mt-4 flex items-center justify-center gap-3 text-white">
            {resultLabel && (
              <span className="rounded-full bg-white/15 px-4 py-2 text-base font-bold">
                {resultLabel}
              </span>
            )}
            <span className="text-base font-semibold">
              {serverResult.rank}/{serverResult.totalPlayers}위
            </span>
          </div>
        )}
        <div className="text-center text-white/50 text-sm mt-4">
          수고하셨습니다.
        </div>
      </div>

      {typeof countdown === "number" ? (
        <div className="text-white/80 text-center">
          <div className="text-sm mb-2">자동 종료까지</div>
          <div className="text-6xl font-bold tabular-nums">{countdown}</div>
        </div>
      ) : (
        <button
          onClick={onExit}
          className="py-5 px-10 text-2xl font-bold rounded-2xl border-none bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black shadow-[0_8px_32px_rgba(255,215,0,0.4)] transition-all"
        >
          나가기
        </button>
      )}
    </div>
  );
}
