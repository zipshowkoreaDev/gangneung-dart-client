import type { ReactNode } from "react";

interface QueueLoadingProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children?: ReactNode;
}

export default function QueueLoading({
  title = "대기열 확인 중...",
  message,
  actionLabel,
  onAction,
  actionDisabled = false,
  children,
}: QueueLoadingProps) {
  return (
    <div className="text-white text-center">
      <div className="text-xl mb-2">{title}</div>
      {message && <div className="text-sm opacity-80">{message}</div>}
      {children}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="mt-6 rounded-lg bg-[#FFD700] px-6 py-3 text-base font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
