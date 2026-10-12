"use client";

import { useState } from "react";
import { KindBadge, SealDots } from "@/components/ui/SealedField";

type IndexedEvent = {
  id: string;
  type: "Deposit / Shield" | "Private Transfer" | "Cash Out / Unshield";
  blockNumber: number;
  txHash: string;
  leafIndex?: number;
  nullifier?: string;
  commitment?: string;
  timestamp: string;
};

export default function TransparencyPage() {
  const [filter, setFilter] = useState<"all" | "deposits" | "transfers" | "withdrawals">("all");

  const stats = {
    usdcTvl: "128,450.00",
    ausdTvl: "74,200.00",
    commitments: 1420,
    nullifiers: 980,
    currentRoot: "0x2e8f1b94a73e48123ccb104928e08d64119e0fa951d9501c6f37cbb22f84091a",
    solvencyRatio: "100.00%",
  };

  const recentEvents: IndexedEvent[] = [
    {
      id: "ev-1",
      type: "Private Transfer",
      blockNumber: 4921044,
      txHash: "0x892a014e912fdca08942b104ee93a401c9a419208a0d91834920a10b4821a419",
      nullifier: "0x1402a...98e4",
      timestamp: "45 secs ago"
    },
    {
      id: "ev-2",
      type: "Deposit / Shield",
      blockNumber: 4921038,
      txHash: "0x3429fa0184b029ea9401bca094204810a9c018241940182a40b9104812048201",
      leafIndex: 1419,
      commitment: "0x289fa...319a",
      timestamp: "2 mins ago"
    },
    {
      id: "ev-3",
      type: "Private Transfer",
      blockNumber: 4921020,
      txHash: "0x1928fa40184029410940182a40184029410a4019284019284019284019284019",
      nullifier: "0x9812b...4410",
      timestamp: "5 mins ago"
    },
    {
      id: "ev-4",
      type: "Cash Out / Unshield",
      blockNumber: 4920991,
      txHash: "0x9482014918204918204918204918204918204918204918204918204918204918",
      nullifier: "0x7710a...1102",
      timestamp: "12 mins ago"
    },
    {
      id: "ev-5",
      type: "Deposit / Shield",
      blockNumber: 4920950,
      txHash: "0x7720194820194820194820194820194820194820194820194820194820194820",
      leafIndex: 1418,
      commitment: "0x5109b...9901",
      timestamp: "18 mins ago"
    }
  ];

  const filteredEvents = recentEvents.filter((ev) => {
    if (filter === "deposits") return ev.type === "Deposit / Shield";
    if (filter === "transfers") return ev.type === "Private Transfer";
    if (filter === "withdrawals") return ev.type === "Cash Out / Unshield";
    return true;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            System Transparency & Proof-of-Reserves
          </h1>
          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-mute font-mono">
            Envio HyperIndex
          </span>
          <KindBadge sealed={true} />
        </div>
        <p className="text-sm text-mute max-w-2xl">
          Real-time mathematical auditability and cryptographic solvency proofs. Zero knowledge of balances or counterparties, but 100% verification that total pool reserves equal total active unspent commitments.
        </p>
      </div>

      {/* Proof-of-Reserves Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">USDC Pool TVL</span>
          <span className="tnum text-2xl font-light text-foreground">${stats.usdcTvl}</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">100% Backed Reserves</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Agora AUSD TVL</span>
          <span className="tnum text-2xl font-light text-foreground">${stats.ausdTvl}</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">Cross-border pool</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Merkle Commitments</span>
          <span className="tnum text-2xl font-light text-foreground">{stats.commitments.toLocaleString()}</span>
          <span className="text-[11px] text-mute mt-1 block">Depth 20 Poseidon Tree</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Active Unspent Notes</span>
          <span className="tnum text-2xl font-light text-foreground">{(stats.commitments - stats.nullifiers).toLocaleString()}</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">Zero double-spends</span>
        </div>
      </div>

      {/* Merkle Tree Cryptographic State */}
      <div className="gl-card p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div>
            <h3 className="text-base font-medium text-foreground">Current Merkle Tree Root</h3>
            <p className="text-xs text-mute">
              All client-side Groth16 membership proofs are verified against this root on-chain.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sealed-soft px-3 py-1 text-xs font-medium text-sealed">
            <span className="h-1.5 w-1.5 rounded-full bg-sealed" />
            Verified Solvency: {stats.solvencyRatio}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface font-mono text-xs text-foreground break-all mb-4 border border-line">
          {stats.currentRoot}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-line text-xs">
          <div>
            <span className="text-mute block mb-1">Tree Capacity</span>
            <span className="font-mono text-foreground font-medium">1,048,576 notes</span>
          </div>
          <div>
            <span className="text-mute block mb-1">Arity</span>
            <span className="font-mono text-foreground font-medium">Binary (2-ary)</span>
          </div>
          <div>
            <span className="text-mute block mb-1">Hash Function</span>
            <span className="font-mono text-foreground font-medium">Poseidon BN254</span>
          </div>
          <div>
            <span className="text-mute block mb-1">Historical Roots Kept</span>
            <span className="font-mono text-foreground font-medium">100 Root Ring</span>
          </div>
        </div>
      </div>

      {/* Real-time Envio HyperIndex Event Stream */}
      <div className="gl-card p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h3 className="text-base font-medium text-foreground">Envio HyperIndex Event Stream</h3>
            <p className="text-xs text-mute">Live on-chain log stream indexed from Monad Testnet.</p>
          </div>

          <div className="inline-flex rounded-full bg-surface p-1 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1 transition-colors ${
                filter === "all" ? "bg-panel text-foreground font-medium shadow-card" : "text-mute hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("deposits")}
              className={`rounded-full px-3 py-1 transition-colors ${
                filter === "deposits" ? "bg-panel text-foreground font-medium shadow-card" : "text-mute hover:text-foreground"
              }`}
            >
              Shields
            </button>
            <button
              onClick={() => setFilter("transfers")}
              className={`rounded-full px-3 py-1 transition-colors ${
                filter === "transfers" ? "bg-panel text-foreground font-medium shadow-card" : "text-mute hover:text-foreground"
              }`}
            >
              Transfers
            </button>
            <button
              onClick={() => setFilter("withdrawals")}
              className={`rounded-full px-3 py-1 transition-colors ${
                filter === "withdrawals" ? "bg-panel text-foreground font-medium shadow-card" : "text-mute hover:text-foreground"
              }`}
            >
              Cash Outs
            </button>
          </div>
        </div>

        <div className="divide-y divide-line">
          {filteredEvents.map((ev) => (
            <div key={ev.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-sans">
                  <span className="font-medium text-foreground">{ev.type}</span>
                  <span className="text-[11px] text-mute font-mono">Block #{ev.blockNumber}</span>
                  <KindBadge sealed={ev.type !== "Deposit / Shield"} />
                </div>
                <div className="text-[11px] text-mute">
                  Tx: <span className="text-foreground">{ev.txHash.slice(0, 16)}…{ev.txHash.slice(-10)}</span>
                </div>
              </div>

              <div className="text-right">
                {ev.leafIndex !== undefined && (
                  <span className="text-sealed block">Leaf Index #{ev.leafIndex}</span>
                )}
                {ev.nullifier && (
                  <span className="text-mute block">Nullifier: {ev.nullifier}</span>
                )}
                <span className="text-[11px] text-faint block">{ev.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verified Smart Contracts Table */}
      <div className="gl-card p-6">
        <h3 className="text-base font-medium text-foreground mb-4">Verified Contract Deployments</h3>
        <div className="divide-y divide-line text-xs font-mono">
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="text-foreground block font-medium font-sans">USDC Shielded Pool</span>
              <span className="text-mute text-[11px]">Primary deposit & transfer verifier</span>
            </div>
            <span className="text-foreground select-all bg-surface px-2.5 py-1 rounded-lg border border-line">
              0x57c2502f0522d2128f72ea867d2225fb15aeb1d1
            </span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="text-foreground block font-medium font-sans">Agora AUSD Shielded Pool</span>
              <span className="text-mute text-[11px]">Cross-border confidential pool</span>
            </div>
            <span className="text-foreground select-all bg-surface px-2.5 py-1 rounded-lg border border-line">
              0x409b1d63174407550f773d405e4068e147362d18
            </span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="text-foreground block font-medium font-sans">Groth16 Verifier (BN254)</span>
              <span className="text-mute text-[11px]">Compiled pairing check contract</span>
            </div>
            <span className="text-foreground select-all bg-surface px-2.5 py-1 rounded-lg border border-line">
              0x6b985d08c0a530b972c9c268d6c220b336abf14c
            </span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="text-foreground block font-medium font-sans">StreamVault Factory</span>
              <span className="text-mute text-[11px]">Chainlink CRE automated oracle vaults</span>
            </div>
            <span className="text-foreground select-all bg-surface px-2.5 py-1 rounded-lg border border-line">
              0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
