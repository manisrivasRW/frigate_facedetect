import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deekshabhoomi 2025 - Face Logs",
  description: "Created by Randomwalk.ai",
  // Use app/icon.png as the favicon across rel types for broader support
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", rel: "icon" },
      { url: "/icon.png", type: "image/png", rel: "shortcut icon" },
      { url: "/icon.png", type: "image/png", rel: "apple-touch-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased bg-gradient-to-b from-black via-[#0b132b] to-black text-[#c7e0ff] min-h-screen`}
      >
        {children}
        <footer className="mt-8 text-center text-[10px] sm:text-xs text-[#9ad7ff]/60 py-4">
          Powered by Randomwalk.ai
        </footer>
      </body>
    </html>
  );
}
