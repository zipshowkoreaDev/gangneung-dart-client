import { stripDisplayName } from "@/lib/displayName";

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
  const displayName = stripDisplayName(name);
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
      <div className="text-center text-[28px] font-bold text-neutral-900">
        게임 완료!
      </div>

      <div className="w-full max-w-[320px] rounded-3xl border border-black/10 bg-white/72 p-8 backdrop-blur-sm">
        <div className="mb-2 text-center text-lg text-neutral-600">
          {displayName}
        </div>
        <div className="text-center">
          <span className="text-6xl font-bold text-[#FFD700]">{score}점</span>
        </div>
        {serverResult && (
          <div className="mt-4 flex items-center justify-center gap-3 text-neutral-800">
            {resultLabel && (
              <span className="rounded-full bg-black/6 px-4 py-2 text-base font-bold">
                {resultLabel}
              </span>
            )}
            <span className="text-base font-semibold">
              {serverResult.rank}/{serverResult.totalPlayers}위
            </span>
          </div>
        )}
        <div className="mt-4 text-center text-sm text-neutral-500">
          수고하셨습니다.
        </div>
      </div>

      {typeof countdown !== "number" && (
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
