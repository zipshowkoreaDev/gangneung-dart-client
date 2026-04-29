"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_ROOM } from "@/lib/room";
import { getBaseUrl } from "@/lib/url";
import { generateSessionToken } from "@/lib/session";
import { socket } from "@/shared/socket";

interface QRData {
  url: string;
  createdAt: number;
}

export default function AdminQRPage() {
  const buildQrCode = useCallback((createdAt: number): QRData => {
    const baseUrl = getBaseUrl();
    const token = generateSessionToken();
    const params = new URLSearchParams({ room: DEFAULT_ROOM });

    if (typeof window !== "undefined") {
      const radius = new URLSearchParams(window.location.search).get("radius");
      if (radius) {
        params.set("radius", radius);
      }
    }

    return {
      url: `${baseUrl}/auth/${token}?${params.toString()}`,
      createdAt,
    };
  }, []);

  const [qrCode, setQrCode] = useState<QRData | null>(() => {
    if (typeof window === "undefined") return null;
    return buildQrCode(Date.now());
  });

  const generateQRCodes = useCallback(() => {
    setQrCode(buildQrCode(Date.now()));
  }, [buildQrCode]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    alert("클립보드에 복사되었습니다!");
  }, []);

  const disconnectRoom = useCallback(() => {
    const confirmed = window.confirm(
      "현재 방의 모든 연결을 종료하고 세션을 정리할까요?",
    );
    if (!confirmed) return;

    if (!socket.connected) {
      socket.io.opts.query = { room: DEFAULT_ROOM, name: "_admin" };
      socket.connect();
    }

    socket.emit("disconnect-room", { room: DEFAULT_ROOM });
    alert("방 종료 요청을 보냈습니다.");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            현장 접속 QR
          </h1>
          <p className="text-gray-400">
            &quot;{DEFAULT_ROOM}&quot; 체험을 위한 현장 한정 QR 코드
          </p>
        </div>

        {qrCode ? (
          <div className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => generateQRCodes()}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg"
                >
                  새 QR 코드 생성
                </button>
                <button
                  onClick={disconnectRoom}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg"
                >
                  방 종료
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <div className="flex flex-col gap-6">
                  <div className="text-center">
                    <div className="inline-block px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
                      <span className="text-2xl font-bold text-white">
                        현장 체험 QR
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl">
                      <QRCodeSVG
                        value={qrCode.url}
                        size={280}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-blue-300 mb-2">
                        Room ID
                      </div>
                      <div className="text-xl font-bold text-white">
                        {DEFAULT_ROOM}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-400 mb-2">
                        접속 URL
                      </div>
                      <div className="text-xs text-white bg-black/30 p-3 rounded-lg break-all">
                        {qrCode.url}
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      생성 시각:{" "}
                      {new Date(qrCode.createdAt).toLocaleString("ko-KR")}
                    </div>

                    <button
                      onClick={() => copyToClipboard(qrCode.url)}
                      className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      URL 복사
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
            <div className="text-gray-400 text-lg">
              QR 코드를 로딩 중입니다...
            </div>
          </div>
        )}

        <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-300 mb-2">
            사용 방법
          </h3>
          <ol className="text-yellow-100 text-sm space-y-2 list-decimal list-inside">
            <li>위 QR 코드를 현장에 배치합니다</li>
            <li>플레이어가 QR 코드를 스캔하면 세션이 발급됩니다</li>
              <li>플레이어는 {DEFAULT_ROOM} 룸에 입장합니다</li>
            <li>Display는 해당 룸을 구독하여 게임을 표시합니다</li>
            <li>
              새로운 QR 코드가 필요하면 &quot;새 QR 코드 생성&quot; 버튼을
              클릭하세요
            </li>
          </ol>
        </div>

        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-2">
            보안 정보
          </h3>
          <ul className="text-blue-100 text-sm space-y-2">
            <li>
              세션은 <strong>sessionStorage</strong>에 저장되어 브라우저 탭
              단위로 격리됩니다
            </li>
            <li>
              세션은 <strong>24시간</strong> 동안 유효합니다
            </li>
            <li>
              URL을 직접 입력하여 접속한 사용자는 세션이 없어 체험에 접근할 수
              없습니다
            </li>
            <li>탭을 닫으면 세션이 자동으로 삭제됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
