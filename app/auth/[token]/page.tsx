"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { setQRSession, isValidTokenFormat } from "@/lib/session";
import { DEFAULT_ROOM } from "@/lib/room";

/**
 * QR 스캔 시 접속하는 세션 발급 페이지
 * 플로우: QR 스캔 → 토큰 검증 → sessionStorage 저장 → /mobile 리다이렉트
 */
export default function AuthPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params.token as string;
  const room = searchParams.get("room") || DEFAULT_ROOM;
  const isTokenValid = Boolean(token && isValidTokenFormat(token));

  useEffect(() => {
    if (!isTokenValid) return;

    setQRSession(token);
    router.replace(`/mobile?room=${room}`);
  }, [isTokenValid, room, router, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f3f3f1] via-[#ecece8] to-[#d9d9d4] px-5 text-neutral-900">
      <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white/65 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-md">
        <div className="flex flex-col items-center gap-6">
          {isTokenValid && (
            <>
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-black/10 border-t-neutral-700" />
              <div className="text-xl font-semibold text-neutral-900">
                QR 코드 인증 중...
              </div>
              <div className="text-sm text-neutral-600">
                모바일 참여 세션을 확인하고 있습니다.
              </div>
            </>
          )}

          {!isTokenValid && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-10 w-10 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="text-xl font-semibold text-neutral-900">
                인증 실패
              </div>
              <div className="text-sm text-neutral-600">
                유효하지 않은 QR 코드입니다.
              </div>
              <div className="text-xs text-neutral-500">
                올바른 QR 코드를 다시 스캔해주세요.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
