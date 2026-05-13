import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepCast 🎣",
  description: "链上钓鱼竞技平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}