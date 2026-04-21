interface QueueLoadingProps {
  title?: string;
  message?: string;
}

export default function QueueLoading({
  title = "대기열 확인 중...",
  message,
}: QueueLoadingProps) {
  return (
    <div className="text-white text-center">
      <div className="text-xl mb-2">{title}</div>
      {message && <div className="text-sm opacity-80">{message}</div>}
    </div>
  );
}
