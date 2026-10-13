"use client";

import { useState } from "react";
import { Landing } from "@/components/landing/Landing";
import { Veiled } from "@/components/ui/Veiled";
import Link from "next/link";
import { useApp } from "@/components/Providers";
import { SealedField, SealDots, KindBadge } from "@/components/ui/SealedField";
import { DepositModal } from "@/components/DepositModal";
import { SendModal } from "@/components/SendModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { FundAnyChainModal } from "@/components/FundAnyChainModal";
import { fmt, veilAddressOf } from "@/lib/veil";
import { CHAIN_ID } from "@/lib/config";
import { AssetToggle } from "@/components/ModalShell";

export default function Home() {
  const { session, notes, isSyncing, triggerSync, asset, setAsset, balances, client } = useApp();
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [showBal, setShowBal] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);


  // Signed out: marketing landing page
  if (!session) return <Landing />;

  // Signed in: portfolio
  const balance = notes.reduce((a, b) => a + (b.spent ? 0n : b.amount), 0n);
  const formattedBalance = (Number(balance) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mainVeilAddress = veilAddressOf(session.keys.main);

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
              <Veiled open={showBal}>${formattedBalance}</Veiled> <span className="text-xl sm:text-2xl text-mute">{asset}</span>
            </p>
            <div className="mt-3"><AssetToggle asset={asset} setAsset={setAsset} /></div>
            <p className="text-[11px] text-mute">USDC <Veiled open={showBal}>{fmt(balances.USDC)}</Veiled> · AUSD <Veiled open={showBal}>{fmt(balances.AUSD)}</Veiled></p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowBal((v) => !v)} className="btn btn-ghost btn-sm" aria-pressed={showBal}>
              {showBal ? "Hide amounts" : "Show amounts"}
            </button>
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
                  <div key={i} className="veil-hover flex justify-between items-center p-3 rounded-xl bg-surface text-xs transition-colors hover:bg-surface-2">
                    <div>
                      <p className="font-medium text-foreground">Note #{n.index ?? i}</p>
                      <p className="text-[11px] text-mute">
                        {n.spent ? "Nullified (spent)" : "Active commitment"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Veiled open={showBal} mode="group">
                        <span className={`font-medium tnum block ${n.spent ? "text-mute line-through" : "text-sealed"}`}>
                          ${(Number(n.amount) / 1_000_000).toFixed(2)}
                        </span>
                      </Veiled>
                      <a
                        className="text-[11px] text-mute underline"
                        href={`/verify#${btoa(JSON.stringify({ chainId: CHAIN_ID, pool: client(asset)?.pool.address, index: n.index, amount: n.amount.toString(), pubKey: n.pubKey.toString(), blinding: n.blinding.toString(), commitment: n.commitment.toString() }))}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        receipt
                      </a>
                    </div>
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
