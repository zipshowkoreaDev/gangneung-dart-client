interface WaitingScreenProps {
  aheadCount?: number | null;
  queue?: string[] | null;
}

export default function WaitingScreen({
  aheadCount,
  queue,
}: WaitingScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center text-neutral-900">
      <div className="mb-3 text-2xl font-bold">플레이 중입니다</div>
      <div className="text-sm text-neutral-600">잠시만 기다려주세요...</div>
      {typeof aheadCount === "number" && aheadCount >= 0 && (
        <div className="mt-3 text-xs text-neutral-500">
          내 앞 대기 인원: {aheadCount}명
        </div>
      )}
      {Array.isArray(queue) && (
        <div className="mt-4 break-all text-[11px] text-neutral-500">
          현재 대기열: {queue.join(", ")}
        </div>
      )}
    </div>
  );
}
