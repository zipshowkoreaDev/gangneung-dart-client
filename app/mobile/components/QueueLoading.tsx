interface QueueLoadingProps {
  title?: string;
  message?: string;
  remainingSeconds?: number | null;
}

export default function QueueLoading({
  title = "대기열 확인 중...",
  message,
  remainingSeconds,
}: QueueLoadingProps) {
  return (
    <div className="text-white text-center">
      <div className="text-xl mb-2">{title}</div>
      {message && <div className="text-sm opacity-80">{message}</div>}
      {typeof remainingSeconds === "number" && (
        <div className="mt-4 text-5xl font-bold tabular-nums">
          {remainingSeconds}
        </div>
      )}
    </div>
  );
}
