"use client";

import { useState } from "react";
import { 
  ArrowRightIcon, 
  PlusIcon, 
  PaperAirplaneIcon, 
  ShieldCheckIcon,
  ArrowDownOnSquareIcon, 
  GlobeAltIcon,
  SparklesIcon,
  LockClosedIcon,
  ArrowPathIcon,
  CheckBadgeIcon
} from "@heroicons/react/24/outline";
import { useApp } from "@/components/Providers";
import { loginOrRegister } from "@/lib/wallet";
import { DepositModal } from "@/components/DepositModal";
import { SendModal } from "@/components/SendModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { FundAnyChainModal } from "@/components/FundAnyChainModal";

export default function Home() {
  const { session, notes, isSyncing, lastSync, triggerSync } = useApp();
  const [loading, setLoading] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [activePool, setActivePool] = useState<"USDC" | "AUSD">("USDC");

  const handleLogin = async () => {
    try {
      setLoading(true);
      await loginOrRegister();
    } catch (e: any) {
      alert("Passkey authentication failed: " + (e.message || "Operation cancelled"));
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full py-16 px-4">
        {/* Glow ambient background */}
        <div className="relative max-w-lg w-full">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 opacity-30 blur-2xl animate-pulse" />
          
          <div className="relative glass-panel rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-indigo-400/30 flex items-center justify-center mb-6 shadow-inner">
              <ShieldCheckIcon className="w-10 h-10 text-indigo-400" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <SparklesIcon className="w-3.5 h-3.5" /> Client-Side ZK Privacy on Monad
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-gradient-to-br from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              Welcome to Veil
            </h1>
            
            <p className="text-neutral-400 text-sm leading-relaxed mb-8 max-w-sm">
              Pay people and autonomous AI agents privately. No seed phrases, no operators, and zero on-chain amount leakage.
            </p>

            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Authenticating Passkey...
                </>
              ) : (
                <>
                  <span>Sign in with Passkey (Mera)</span>
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/5 text-xs text-neutral-400">
              <span className="flex items-center gap-1">
                <CheckBadgeIcon className="w-4 h-4 text-emerald-400" /> Face ID / Touch ID
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <LockClosedIcon className="w-4 h-4 text-indigo-400" /> Groth16 Prover
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const balance = notes.reduce((a, b) => a + (b.spent ? 0n : b.amount), 0n);
  const formattedBalance = (Number(balance) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [balanceInt, balanceFrac] = formattedBalance.split('.');

  const mainVeilAddress = `veil:0x${session.keys.main.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.main.encPub).toString("hex")}`;

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {isDepositOpen && <DepositModal onClose={() => setIsDepositOpen(false)} />}
      {isSendOpen && <SendModal onClose={() => setIsSendOpen(false)} />}
      {isWithdrawOpen && <WithdrawModal onClose={() => setIsWithdrawOpen(false)} />}
      {isFundOpen && <FundAnyChainModal onClose={() => setIsFundOpen(false)} />}
      
      {/* Balance Hero Card */}
      <div className="w-full relative rounded-3xl p-8 lg:p-10 overflow-hidden shadow-2xl border border-white/10 bg-gradient-to-br from-neutral-900/90 via-indigo-950/40 to-neutral-950">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/10 blur-[90px] pointer-events-none rounded-full" />

        <div className="flex flex-wrap justify-between items-center gap-4 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Shielded Vault
            </span>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setActivePool("USDC")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  activePool === "USDC" ? "bg-indigo-600 text-white shadow" : "text-neutral-400 hover:text-white"
                }`}
              >
                USDC Pool
              </button>
              <button
                onClick={() => setActivePool("AUSD")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  activePool === "AUSD" ? "bg-purple-600 text-white shadow" : "text-neutral-400 hover:text-white"
                }`}
              >
                Agora AUSD
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 transition-colors cursor-pointer"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-indigo-400" : ""}`} />
              {isSyncing ? "Syncing Leaves..." : "Refresh State"}
            </button>
            <span className="text-neutral-400">
              {lastSync ? `Updated ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Synced"}
            </span>
          </div>
        </div>

        {/* Big Balance Number */}
        <div className="mb-8 relative z-10">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl lg:text-7xl font-black tracking-tight text-white">
              ${balanceInt}
            </span>
            <span className="text-2xl lg:text-4xl font-bold text-neutral-400">
              .{balanceFrac}
            </span>
            <span className="ml-3 text-sm font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {activePool}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1.5">
            <LockClosedIcon className="w-3.5 h-3.5 text-emerald-400" />
            Unspent note commitments verified against tree root on Monad
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
          <button 
            onClick={() => setIsDepositOpen(true)}
            className="bg-white text-black hover:bg-neutral-100 font-bold py-3 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <PlusIcon className="w-4 h-4 text-black stroke-[2.5]" />
            Deposit
          </button>
          
          <button 
            onClick={() => setIsSendOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <PaperAirplaneIcon className="w-4 h-4 stroke-[2.5]" />
            Send Private
          </button>
          
          <button 
            onClick={() => setIsWithdrawOpen(true)}
            className="bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <ArrowDownOnSquareIcon className="w-4 h-4 stroke-[2.5]" />
            Withdraw
          </button>
          
          <button 
            onClick={() => setIsFundOpen(true)}
            className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 hover:from-blue-600/40 hover:to-purple-600/40 border border-purple-400/30 text-purple-200 font-bold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <GlobeAltIcon className="w-4 h-4 stroke-[2.5]" />
            Fund (Base/Any)
          </button>
        </div>
      </div>

      {/* Activity & Identity Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shielded Notes & Activity */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">Shielded Activity & Notes</h3>
              <span className="text-xs text-neutral-400">{notes.length} total note(s)</span>
            </div>
            
            {notes.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No active shielded notes yet. Deposit USDC or receive a private transfer to see your notes here.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {notes.map((note, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-2xl bg-black/30 border border-white/5 text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">
                        Note #{note.index ?? idx}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {note.spent ? "Nullified (Spent)" : "Active Shielded Leaf"}
                      </span>
                    </div>
                    <span className={`font-bold font-mono ${note.spent ? "text-neutral-500 line-through" : "text-emerald-400"}`}>
                      ${(Number(note.amount) / 1_000_000).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 text-[11px] text-neutral-400 flex items-center justify-between mt-4">
            <span>Proofs: Groth16 (BN254)</span>
            <span className="text-emerald-400 font-semibold">Zero Leaks</span>
          </div>
        </div>

        {/* Identity & Key Summary */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">Your Cryptographic Identity</h3>
              <span className="text-xs text-indigo-400 font-mono">BIP-44 derived</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5">
                <span className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  Primary Shielded Address (Veil)
                </span>
                <div className="font-mono text-xs text-neutral-200 truncate select-all">
                  {mainVeilAddress}
                </div>
              </div>

              <div className="bg-black/40 p-3.5 rounded-2xl border border-white/5">
                <span className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  Public Funding EOA (Monad)
                </span>
                <div className="font-mono text-xs text-neutral-200 truncate select-all">
                  {session.publicAccount.address}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-between items-center text-xs mt-4">
            <span className="text-neutral-400">Derived from 1 passkey</span>
            <a href="/accounts" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Manage Key Tree →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
