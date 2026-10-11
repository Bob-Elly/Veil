"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheckIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useApp } from "./Providers";
import { logout } from "@/lib/wallet";

export function Navbar() {
  const pathname = usePathname();
  const { session, isSyncing, lastSync } = useApp();

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/payroll", label: "Payroll" },
    { href: "/campaigns", label: "Campaigns (CRE)" },
    { href: "/accounts", label: "Accounts & Keys" },
    { href: "/verify", label: "Verify Receipt" },
    { href: "/transparency", label: "Transparency" },
  ];

  return (
    <header className="px-8 py-4 flex flex-wrap justify-between items-center z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
            <ShieldCheckIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-300 via-purple-200 to-pink-300 bg-clip-text text-transparent">
            Veil
          </span>
        </Link>

        <nav className="hidden md:flex gap-1 items-center bg-white/5 p-1 rounded-2xl border border-white/5 text-sm">
          {navLinks.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  active
                    ? "bg-indigo-500/20 text-indigo-300 font-medium shadow-sm border border-indigo-500/30"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {session ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                {isSyncing ? "Syncing tree..." : lastSync ? "Synced" : "Ready"}
              </span>
              <span className="font-mono text-neutral-500">
                {session.publicAccount.address.slice(0, 6)}...{session.publicAccount.address.slice(-4)}
              </span>
            </div>

            <Link
              href="/accounts"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors"
              title="View Derived Keys"
            >
              <UserCircleIcon className="w-5 h-5" />
            </Link>

            <button
              onClick={() => logout()}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-neutral-400 hover:text-red-300 transition-colors"
              title="Sign Out"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Monad Testnet
          </span>
        )}
      </div>
    </header>
  );
}
