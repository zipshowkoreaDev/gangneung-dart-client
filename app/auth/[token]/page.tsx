"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { setQRSession, isValidTokenFormat } from "@/lib/session";

const DEFAULT_ROOM = "zipshow";

/**
 * QR 스캔 시 접속하는 세션 발급 페이지
 * 플로우: QR 스캔 → 토큰 검증 → sessionStorage 저장 → /mobile 리다이렉트
 */
export default function AuthPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"validating" | "error">("validating");

  useEffect(() => {
    const validateAndRedirect = async () => {
      const token = params.token as string;
      const room = searchParams.get("room") || DEFAULT_ROOM;

      if (!token || !isValidTokenFormat(token)) {
        setStatus("error");
        return;
      }

      setQRSession(token);
      router.replace(`/mobile?room=${room}`);
    };

    validateAndRedirect();
  }, [params.token, searchParams, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-5">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          {status === "validating" && (
            <>
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <div className="text-white text-xl font-semibold">QR 코드 인증 중...</div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="text-white text-xl font-semibold">인증 실패</div>
              <div className="text-white/70 text-sm">유효하지 않은 QR 코드입니다.</div>
              <div className="text-white/50 text-xs">올바른 QR 코드를 스캔해주세요.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
