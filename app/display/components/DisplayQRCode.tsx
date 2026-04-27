import { QRCodeSVG } from "qrcode.react";

interface DisplayQRCodeProps {
  url: string;
}

const QR_CORNER_OFFSET = "-1.3cqw";
const QR_CORNER_SIZE = "3.8cqw";
const QR_CORNER_RADIUS = "1.35cqw";
const QR_CORNER_BORDER = "0.25cqw";
const QR_CARD_RADIUS = "0.9cqw";

export default function DisplayQRCode({ url }: DisplayQRCodeProps) {
  if (!url) return null;

  return (
    <div className="absolute bottom-[4cqw] left-[4cqw] z-20 p-[1.15cqw]">
      <div className="relative bg-white p-[1.2cqw]" style={{ borderRadius: QR_CARD_RADIUS }}>
        <span
          className="pointer-events-none absolute border-l border-t border-white"
          style={{
            left: QR_CORNER_OFFSET,
            top: QR_CORNER_OFFSET,
            width: QR_CORNER_SIZE,
            height: QR_CORNER_SIZE,
            borderTopLeftRadius: QR_CORNER_RADIUS,
            borderLeftWidth: QR_CORNER_BORDER,
            borderTopWidth: QR_CORNER_BORDER,
          }}
        />
        <span
          className="pointer-events-none absolute border-r border-t border-white"
          style={{
            right: QR_CORNER_OFFSET,
            top: QR_CORNER_OFFSET,
            width: QR_CORNER_SIZE,
            height: QR_CORNER_SIZE,
            borderTopRightRadius: QR_CORNER_RADIUS,
            borderRightWidth: QR_CORNER_BORDER,
            borderTopWidth: QR_CORNER_BORDER,
          }}
        />
        <span
          className="pointer-events-none absolute border-b border-l border-white"
          style={{
            left: QR_CORNER_OFFSET,
            bottom: QR_CORNER_OFFSET,
            width: QR_CORNER_SIZE,
            height: QR_CORNER_SIZE,
            borderBottomLeftRadius: QR_CORNER_RADIUS,
            borderBottomWidth: QR_CORNER_BORDER,
            borderLeftWidth: QR_CORNER_BORDER,
          }}
        />
        <span
          className="pointer-events-none absolute border-b border-r border-white"
          style={{
            right: QR_CORNER_OFFSET,
            bottom: QR_CORNER_OFFSET,
            width: QR_CORNER_SIZE,
            height: QR_CORNER_SIZE,
            borderBottomRightRadius: QR_CORNER_RADIUS,
            borderBottomWidth: QR_CORNER_BORDER,
            borderRightWidth: QR_CORNER_BORDER,
          }}
        />
        <QRCodeSVG
          value={url}
          size={100}
          level="H"
          className="relative block h-[20cqw] w-[20cqw]"
        />
      </div>
    </div>
  );
}
