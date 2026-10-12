"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { logout } from "@/lib/wallet";

export function Navbar() {
  const pathname = usePathname();
  const { session, isSyncing, lastSync } = useApp();

  const navLinks = [
    { href: "/", label: "Portfolio" },
    { href: "/vault", label: "Vault" },
    { href: "/payroll", label: "Payroll" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/accounts", label: "Accounts" },
    { href: "/verify", label: "Verify" },
    { href: "/transparency", label: "Transparency" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-7">
        <div className="flex items-center gap-8">
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="shrink-0">
              <rect width="32" height="32" rx="9" fill="var(--foreground)" />
              <rect x="15" y="4" width="12" height="12" rx="3.5" fill="var(--background)" />
            </svg>
            <span className="text-[19px] font-medium leading-none tracking-[-0.015em] text-foreground">
              Veil
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {navLinks.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-1.5 text-[14px] transition-colors ${
                    active
                      ? "bg-surface text-foreground font-medium"
                      : "text-mute hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-mute">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            Monad Testnet
          </span>

          {session ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end text-[11px] leading-tight">
                <span className="text-mute flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? "bg-amber-500 animate-pulse" : "bg-green"}`} />
                  {isSyncing ? "Syncing" : lastSync ? "Synced" : "Ready"}
                </span>
                <span className="font-mono text-faint">
                  {session.publicAccount.address.slice(0, 6)}…{session.publicAccount.address.slice(-4)}
                </span>
              </div>

              <button
                onClick={() => logout()}
                className="btn btn-ghost btn-sm text-[13px]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/" className="btn btn-ink btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
