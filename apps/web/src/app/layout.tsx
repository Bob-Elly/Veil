import "./globals.css";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";


export const metadata: Metadata = {
  title: "Veil · Private payments on Monad",
  description: "Pay people and AI agents on Monad without publishing amounts. Payroll, KOL streams and x402, with proofs made on your device.",
};

export const viewport: Viewport = { themeColor: "#09090a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain min-h-screen bg-background text-foreground antialiased flex flex-col">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
