import type { Metadata } from "next";
import "./globals.css";
import NaverAnalytics from "./shared/NaverAnalytics";

export const metadata: Metadata = {
  title: "Gangneung Dart Game",
  description: "Gangneung Dart Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <NaverAnalytics />
      </body>
    </html>
  );
}
