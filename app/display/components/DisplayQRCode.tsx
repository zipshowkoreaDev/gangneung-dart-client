import { QRCodeSVG } from "qrcode.react";

interface DisplayQRCodeProps {
  url: string;
}

export default function DisplayQRCode({ url }: DisplayQRCodeProps) {
  if (!url) return null;

  return (
    <div className="absolute bottom-10 left-10 z-20 bg-white p-3 rounded-sm shadow-lg">
      <QRCodeSVG value={url} size={100} level="H" />
    </div>
  );
}
