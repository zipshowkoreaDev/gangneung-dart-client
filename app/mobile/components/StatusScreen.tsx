import type { ReactNode } from "react";

interface StatusScreenProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children?: ReactNode;
}

export default function StatusScreen({
  title = "참가 상태 확인 중...",
  message,
  actionLabel,
  onAction,
  actionDisabled = false,
  children,
}: StatusScreenProps) {
  return (
    <div className="text-center text-neutral-900">
      <div className="mb-2 text-xl font-semibold">{title}</div>
      {message && <div className="text-sm text-neutral-600">{message}</div>}
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
