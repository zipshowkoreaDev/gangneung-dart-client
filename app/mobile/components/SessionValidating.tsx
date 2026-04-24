// 세션 검증 중 로딩 화면
export default function SessionValidating() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-black/10 border-t-neutral-700" />
      <div className="mt-6 text-lg text-neutral-800">세션 확인 중...</div>
    </div>
  );
}
