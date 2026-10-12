"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/Providers";
import { loginOrRegister } from "@/lib/wallet";
import { SealedField, SealDots, KindBadge } from "@/components/ui/SealedField";
import { DepositModal } from "@/components/DepositModal";
import { SendModal } from "@/components/SendModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { FundAnyChainModal } from "@/components/FundAnyChainModal";

export default function Home() {
  const { session, notes, isSyncing, triggerSync } = useApp();
  const [loading, setLoading] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await loginOrRegister();
    } catch (e: any) {
      alert("Authentication failed: " + (e.message || "Cancelled"));
    } finally {
      setLoading(false);
    }
  };

  // If signed out: Gloam clean landing hero
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 sm:py-24">
        {/* Glow Hero Panel */}
        <div className="gl-panel w-full max-w-4xl rounded-[28px] border border-line bg-panel p-8 sm:p-16 shadow-card relative">
          <SealedField />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sealed-soft px-3 py-1 text-[12px] font-medium text-sealed mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-sealed" />
              Private payments on Monad
            </span>

            <h1 className="text-4xl sm:text-6xl font-light tracking-[-0.03em] text-foreground leading-[1.08] mb-6">
              Pay people and agents without publishing amounts.
            </h1>

            <p className="text-lg text-mute leading-relaxed mb-10 max-w-xl">
              Veil shields stablecoins on Monad with client-side zero-knowledge proofs. No seed phrase, no operator who can see your payroll, and settled in one block.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="btn btn-ink btn-lg"
              >
                {loading ? "Authenticating Passkey…" : "Sign in with Passkey →"}
              </button>
              <Link href="/verify" className="btn btn-ghost btn-lg">
                Verify a receipt
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid (Gloam live mini cards style) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mt-10">
          <div className="gl-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-mute mb-4">
                <span>Shielded Pool</span>
                <KindBadge sealed={true} />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">One-Click Shield</h3>
              <p className="text-sm text-mute">
                Deposit USDC or Agora AUSD from Monad, or confidential-swap from Base via Aurora Intents.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-xs font-mono text-faint">
              2-in / 2-out circuit
            </div>
          </div>

          <div className="gl-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-mute mb-4">
                <span>Batch Payments</span>
                <span className="text-xs text-sealed font-medium">Agora AUSD</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Confidential Payroll</h3>
              <p className="text-sm text-mute">
                Pay remote teams from CSV. Recipients without a Veil account get instant claim links.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-xs font-mono text-faint">
              Sequential crash-safe
            </div>
          </div>

          <div className="gl-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-mute mb-4">
                <span>AI Infra</span>
                <span className="text-xs text-foreground font-mono">@veil/mm-plugin</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Agent Wallets</h3>
              <p className="text-sm text-mute">
                AI agents pay each other and paid x402 APIs privately within owner-set guard limits.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-xs font-mono text-faint">
              Track 04 Trust & AI
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Signed in: Gloam Portfolio & Vault layout
  const balance = notes.reduce((a, b) => a + (b.spent ? 0n : b.amount), 0n);
  const formattedBalance = (Number(balance) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mainVeilAddress = `veil:0x${session.keys.main.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.main.encPub).toString("hex")}`;

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {isDepositOpen && <DepositModal onClose={() => setIsDepositOpen(false)} />}
      {isSendOpen && <SendModal onClose={() => setIsSendOpen(false)} />}
      {isWithdrawOpen && <WithdrawModal onClose={() => setIsWithdrawOpen(false)} />}
      {isFundOpen && <FundAnyChainModal onClose={() => setIsFundOpen(false)} />}

      {/* Main Vault Panel */}
      <div className="gl-panel rounded-[24px] border border-line bg-panel p-6 sm:p-8 shadow-card relative">
        <SealedField />

        <div className="relative z-10 flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-mute uppercase tracking-wider">
                Shielded Portfolio
              </span>
              <KindBadge sealed={true} />
            </div>
            <p className="tnum text-4xl sm:text-6xl font-light tracking-[-0.03em] text-foreground">
              ${formattedBalance} <span className="text-xl sm:text-2xl text-mute">USDC</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="btn btn-ghost btn-sm"
            >
              {isSyncing ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Action Buttons (Gloam Vault buttons) */}
        <div className="relative z-10 flex flex-wrap gap-2.5 pt-4 border-t border-line/60">
          <Link
            href="/vault?tab=shield"
            className="btn btn-ink btn-sm"
          >
            Add money (Shield)
          </Link>
          <Link
            href="/vault?tab=move"
            className="btn btn-accent btn-sm"
          >
            Send privately
          </Link>
          <Link
            href="/vault?tab=cashout"
            className="btn btn-ghost btn-sm"
          >
            Cash out
          </Link>
          <Link
            href="/vault?tab=fund"
            className="btn btn-ghost btn-sm"
          >
            Fund from Base
          </Link>
          <Link
            href="/vault"
            className="btn btn-ghost btn-sm ml-auto text-mute hover:text-foreground"
          >
            Open Vault Hub →
          </Link>
        </div>
      </div>

      {/* Two-column Gloam Portfolio cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shielded Notes List */}
        <div className="gl-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[13px] text-mute font-medium">Active Shielded Notes</span>
              <span className="text-xs text-mute">{notes.filter(n => !n.spent).length} unspent</span>
            </div>

            {notes.length === 0 ? (
              <p className="text-xs text-mute py-8 text-center">
                No active shielded notes yet. Click “Add money” to deposit into the pool.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {notes.map((n, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-surface text-xs">
                    <div>
                      <p className="font-medium text-foreground">Note #{n.index ?? i}</p>
                      <p className="text-[11px] text-mute">
                        {n.spent ? "Nullified (spent)" : "Active commitment"}
                      </p>
                    </div>
                    <span className={`font-medium tnum ${n.spent ? "text-mute line-through" : "text-sealed"}`}>
                      ${(Number(n.amount) / 1_000_000).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-line text-[12px] text-mute flex justify-between">
            <span>Merkle tree: Depth 20</span>
            <span className="text-sealed font-medium">Valid on Monad</span>
          </div>
        </div>

        {/* Identity & Keys */}
        <div className="gl-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[13px] text-mute font-medium">Cryptographic Keys</span>
              <span className="text-xs text-mute font-mono">BIP-44</span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-surface p-3">
                <span className="text-[11px] text-mute block mb-1">Your Veil Address (Shielded)</span>
                <span className="font-mono text-xs text-foreground truncate block select-all">
                  {mainVeilAddress}
                </span>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <span className="text-[11px] text-mute block mb-1">Public Funding EOA (Monad)</span>
                <span className="font-mono text-xs text-foreground truncate block select-all">
                  {session.publicAccount.address}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex justify-between items-center text-xs">
            <span className="text-mute">1 passkey · 5 key tiers</span>
            <Link href="/accounts" className="font-medium text-foreground hover:underline">
              View Key Tree →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
