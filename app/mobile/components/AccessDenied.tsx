// QR 스캔 없이 직접 접속 시 접근 제한 화면
export default function AccessDenied() {
  return (
    <div className="max-w-md w-full rounded-3xl border border-black/10 bg-white/70 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-lg">
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-orange-500/20 border-4 border-orange-500 rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-orange-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div className="text-center text-2xl font-bold text-neutral-900">
          접근 제한
        </div>
        <div className="text-center text-base leading-relaxed text-neutral-700">
          이 체험은 현장에서만 이용 가능합니다.
        </div>
        <div className="mt-2 rounded-xl border border-black/8 bg-black/4 p-4">
          <div className="text-center text-sm leading-relaxed text-neutral-600">
            현장에 비치된{" "}
            <span className="font-bold text-yellow-300">QR 코드</span>를
            스캔하여
            <br />
            체험을 시작해주세요.
          </div>
        </div>
        <div className="mt-4 text-center text-xs text-neutral-500">
          현장 한정 인터랙티브 체험
        </div>
      </div>
    </div>
  );
}
