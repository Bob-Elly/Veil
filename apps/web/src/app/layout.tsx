import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display-face", weight: ["300", "400", "500"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: "Veil · Private payments on Monad",
  description: "Pay people and AI agents on Monad without publishing amounts. Payroll, KOL streams and x402, with proofs made on your device.",
};

export const viewport: Viewport = { themeColor: "#09090a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body className="grain min-h-screen bg-background text-foreground antialiased flex flex-col">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
