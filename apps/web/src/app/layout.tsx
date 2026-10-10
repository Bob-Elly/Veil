import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Veil - Private Payments on Monad",
  description: "Pay people and agents on Monad privately",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-white min-h-screen selection:bg-indigo-500/30`}>
        <Providers>
          <div className="flex flex-col min-h-screen relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
            
            <header className="px-8 py-6 flex justify-between items-center z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
              <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Veil</h1>
              <nav className="flex gap-4 items-center">
                <span className="text-sm font-medium text-neutral-400">Testnet</span>
              </nav>
            </header>
            
            <main className="flex-1 w-full max-w-7xl mx-auto p-8 z-10 flex flex-col">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
