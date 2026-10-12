import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Veil — Private Payments on Monad",
  description: "Pay people and autonomous agents on Monad privately. Amounts and transfer graphs stay sealed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-navy-100 flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-7 py-8 sm:py-12 flex flex-col">
            {children}
          </main>
          
          <footer className="w-full border-t border-line py-8 mt-auto text-xs text-mute text-center">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-7 flex flex-wrap justify-between items-center gap-4">
              <span>Veil · Monad Metropolis (Track 04)</span>
              <span>Self-custodial client-side Groth16 proofs. No operator.</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
