import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scaler Meet",
  description:
    "Zoom-inspired video conferencing web app — native WebRTC P2P Mesh with FastAPI WebSocket signaling",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-white antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
