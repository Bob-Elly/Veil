"use client";

import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { Navbar } from "./Navbar";
import { Logo } from "./ui/Logo";

/** Signed-out home = full-bleed marketing page. Everything else = app chrome. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useApp();
  const landing = pathname === "/" && !session;

  if (landing) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-7 py-8 sm:py-12 flex flex-col">{children}</main>
      <footer className="w-full border-t border-line py-7 mt-auto text-xs text-mute">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-7 flex flex-wrap justify-between items-center gap-4">
          <Logo className="scale-90 origin-left opacity-80" />
          <span>Proofs are generated on your device. Veil never holds your keys.</span>
        </div>
      </footer>
    </>
  );
}
