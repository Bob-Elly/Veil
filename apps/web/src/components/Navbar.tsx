"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { logout } from "@/lib/wallet";
import { Logo } from "./ui/Logo";
import { CHAIN_ID } from "@/lib/config";

const navLinks = [
  { href: "/", label: "Portfolio" },
  { href: "/vault", label: "Vault" },
  { href: "/payroll", label: "Payroll" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/accounts", label: "Accounts" },
  { href: "/verify", label: "Verify" },
  { href: "/transparency", label: "Transparency" },
];

export function Navbar() {
  const pathname = usePathname();
  const { session, isSyncing, lastSync } = useApp();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-7">
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/" className="shrink-0 rounded-lg focus-visible:outline-none"><Logo /></Link>
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {navLinks.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-md px-3 py-1.5 text-[14px] transition-colors duration-300 ${active ? "text-foreground" : "text-mute hover:text-foreground"}`}
                >
                  {item.label}
                  <span className={`absolute left-3 right-3 -bottom-[16px] h-px bg-accent transition-transform duration-500 origin-left ${active ? "scale-x-100" : "scale-x-0"}`} />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] text-mute">
            <span className="h-1.5 w-1.5 rounded-[2px] bg-accent" />
            {CHAIN_ID === 31337 ? "Local chain" : "Monad testnet"}
          </span>
          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-[11px] leading-tight">
                <span className="text-mute flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? "bg-warm" : "bg-green"}`} style={isSyncing ? { animation: "veil-pulse 1.2s infinite" } : undefined} />
                  {isSyncing ? "Syncing" : lastSync ? "Synced" : "Ready"}
                </span>
                <span className="font-mono text-faint">{session.publicAccount.address.slice(0, 6)}…{session.publicAccount.address.slice(-4)}</span>
              </div>
              <button onClick={() => logout()} className="btn btn-ghost btn-sm">Lock</button>
            </div>
          ) : (
            <Link href="/" className="btn btn-ink btn-sm">Launch app ↗</Link>
          )}
        </div>
      </div>
      {/* mobile nav */}
      <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 pb-2 -mt-1 text-[13px]" aria-label="Primary mobile">
        {navLinks.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`shrink-0 rounded-md px-2.5 py-1 ${active ? "bg-surface text-foreground" : "text-mute"}`}>{item.label}</Link>
          );
        })}
      </nav>
    </header>
  );
}
