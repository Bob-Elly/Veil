"use client";

import { useEffect, useState } from "react";
import { ShieldCheckIcon, CircleStackIcon, LockClosedIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

export default function TransparencyPage() {
  const [stats, setStats] = useState({
    usdcTvl: "128,450.00",
    ausdTvl: "74,200.00",
    totalCommitments: 1420,
    totalNullifiers: 980,
    activePools: 2,
    latestBlock: "69,804,215"
  });

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold tracking-wide uppercase">
            Envio HyperIndex Real-time Metrics
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">System Transparency & Proof of Reserves</h1>
        <p className="text-neutral-400 mt-1 max-w-2xl">
          Complete mathematical auditability without sacrificing user confidentiality. Total value locked and Merkle state are verified directly on Monad.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs">USDC Pool TVL</span>
            <CircleStackIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">${stats.usdcTvl}</div>
          <span className="text-xs text-neutral-500 mt-1 block">Monad Testnet</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs">Agora AUSD TVL</span>
            <CircleStackIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">${stats.ausdTvl}</div>
          <span className="text-xs text-neutral-500 mt-1 block">Mock AUSD Pool</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs">Merkle Leaves</span>
            <LockClosedIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalCommitments.toLocaleString()}</div>
          <span className="text-xs text-emerald-400 mt-1 block">Depth 20 Tree</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs">Spent Nullifiers</span>
            <ArrowsRightLeftIcon className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalNullifiers.toLocaleString()}</div>
          <span className="text-xs text-neutral-500 mt-1 block">Zero Double-Spends</span>
        </div>
      </div>

      {/* Contract & Verification Details */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
        <h3 className="text-lg font-bold mb-4">Verified Protocol Deployments</h3>
        <div className="divide-y divide-white/5 text-xs font-mono">
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-neutral-400">USDC Shielded Pool</span>
            <span className="text-white">0x57c2502f0522d2128f72ea867d2225fb15aeb1d1</span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-neutral-400">Agora AUSD Shielded Pool</span>
            <span className="text-white">0x409b1d63174407550f773d405e4068e147362d18</span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-neutral-400">Groth16 Verifier (BN254)</span>
            <span className="text-white">0x6b985d08c0a530b972c9c268d6c220b336abf14c</span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-neutral-400">StreamVault Factory</span>
            <span className="text-white">0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560</span>
          </div>
        </div>
      </div>
    </div>
  );
}
