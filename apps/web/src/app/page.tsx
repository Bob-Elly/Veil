"use client";

import { useState } from "react";
import { ArrowRightIcon, PlusIcon, PaperAirplaneIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useApp } from "@/components/Providers";
import { loginOrRegister } from "@/lib/wallet";
import { DepositModal } from "@/components/DepositModal";
import { SendModal } from "@/components/SendModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { FundAnyChainModal } from "@/components/FundAnyChainModal";
import { ArrowDownOnSquareIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

export default function Home() {
  const { session, notes } = useApp();
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
      alert("Login failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full py-20">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
          <ShieldCheckIcon className="w-16 h-16 text-indigo-400 mb-6" />
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to Veil</h1>
          <p className="text-neutral-400 mb-8">
            Private, secure, and fast payments on Monad.
            Authenticate with your Face ID or Touch ID to get started.
          </p>
          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-semibold py-3 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 group"
          >
            {loading ? "Authenticating..." : "Sign in with Passkey"}
            {!loading && <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </div>
      </div>
    );
  }

  const balance = notes.reduce((a, b) => a + (b.spent ? 0n : b.amount), 0n);
  const formattedBalance = (Number(balance) / 1000000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balanceInt = formattedBalance.split('.')[0];
  const balanceFrac = formattedBalance.split('.')[1];

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {isDepositOpen && <DepositModal onClose={() => setIsDepositOpen(false)} />}
      {isSendOpen && <SendModal onClose={() => setIsSendOpen(false)} />}
      {isWithdrawOpen && <WithdrawModal onClose={() => setIsWithdrawOpen(false)} />}
      {isFundOpen && <FundAnyChainModal onClose={() => setIsFundOpen(false)} />}
      
      {/* Balance Card */}
      <div className="w-full bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-30 transition-opacity">
          <ShieldCheckIcon className="w-48 h-48" />
        </div>
        <h2 className="text-neutral-300 text-sm font-semibold uppercase tracking-wider mb-2 relative z-10">Private Balance (USDC)</h2>
        <div className="text-6xl font-black tracking-tighter mb-8 relative z-10">
          ${balanceInt}<span className="text-3xl text-neutral-400 font-bold">.{balanceFrac}</span>
        </div>
        
        <div className="flex flex-wrap gap-4 relative z-10">
          <button 
            onClick={() => setIsDepositOpen(true)}
            className="flex-1 bg-white text-black hover:bg-neutral-200 font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Deposit
          </button>
          <button 
            onClick={() => setIsSendOpen(true)}
            className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
            Send
          </button>
          <button 
            onClick={() => setIsWithdrawOpen(true)}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <ArrowDownOnSquareIcon className="w-5 h-5" />
            Withdraw
          </button>
          <button 
            onClick={() => setIsFundOpen(true)}
            className="flex-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-purple-500/50 text-purple-300 font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 min-w-[200px]"
          >
            <GlobeAltIcon className="w-5 h-5" />
            Fund from Base
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <div className="flex flex-col">
                <span className="font-medium">Sent to Alice</span>
                <span className="text-xs text-neutral-500">2 mins ago</span>
              </div>
              <span className="font-semibold text-red-400">-$50.00</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div className="flex flex-col">
                <span className="font-medium">Deposit</span>
                <span className="text-xs text-neutral-500">1 hour ago</span>
              </div>
              <span className="font-semibold text-green-400">+$1,000.00</span>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <h3 className="text-lg font-semibold mb-4">Keys & Identities</h3>
          <div className="flex flex-col gap-3">
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
              <div className="font-medium mb-1">Your Veil Address (Main)</div>
              <div className="font-mono text-xs text-neutral-400 truncate">
                veil:0x{session.keys.main.pubKey.toString(16)}
              </div>
            </div>
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
              <div className="font-medium mb-1">Public Wallet (Funding)</div>
              <div className="font-mono text-xs text-neutral-400 truncate">{session.publicAccount.address}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
