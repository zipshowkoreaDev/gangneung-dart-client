import { QRCodeSVG } from "qrcode.react";

interface DisplayQRCodeProps {
  url: string;
}

export default function DisplayQRCode({ url }: DisplayQRCodeProps) {
  if (!url) return null;

  return (
    <div className="absolute bottom-[4cqw] left-[4cqw] z-20 rounded-[0.6cqw] bg-white p-[1.5cqw] shadow-lg">
      <QRCodeSVG
        value={url}
        size={100}
        level="H"
        className="block h-[20cqw] w-[20cqw]"
      />
    </div>
  );
}
