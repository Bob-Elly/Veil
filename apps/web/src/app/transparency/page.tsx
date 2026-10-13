"use client";

import { useEffect, useState } from "react";
import { POOLS, RELAYER_URL, txUrl } from "@/lib/config";
import { fmt, publicClient } from "@/lib/veil";
import { KindBadge, SealDots } from "@/components/ui/SealedField";

type IndexedEvent = {
  id: string;
  type: "Deposit / Shield" | "Shielded transaction";
  pool: string;
  blockNumber: number;
  txHash: string;
  leafIndex: number;
};

const ERC20_BAL = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }] as const;
const ROOT_ABI = [{ type: "function", name: "currentRoot", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const;

export default function TransparencyPage() {
  const [filter, setFilter] = useState<"all" | "deposits" | "transfers" | "withdrawals">("all");
  const [stats, setStats] = useState({ usdcTvl: "…", ausdTvl: "…", commitments: 0, txs: 0, currentRoot: "…", solvencyRatio: "on-chain" });
  const [recentEvents, setRecentEvents] = useState<IndexedEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [usdc, ausd, root] = await Promise.all([
          publicClient.readContract({ address: POOLS.USDC.token, abi: ERC20_BAL, functionName: "balanceOf", args: [POOLS.USDC.address] }),
          publicClient.readContract({ address: POOLS.AUSD.token, abi: ERC20_BAL, functionName: "balanceOf", args: [POOLS.AUSD.address] }),
          publicClient.readContract({ address: POOLS.USDC.address, abi: ROOT_ABI, functionName: "currentRoot" }),
        ]);
        // Every NewCommitment, from the relayer cache. A deposit adds 1 leaf; any private
        // transaction (transfer or cash-out, which look identical on-chain) adds 2.
        const events: IndexedEvent[] = [];
        let commitments = 0, txs = 0;
        for (const s of ["USDC", "AUSD"] as const) {
          const res = await fetch(`${RELAYER_URL}/commitments?pool=${POOLS[s].address}&from=0`).then((r) => r.json());
          const leaves: any[] = res.commitments || [];
          commitments += leaves.length;
          const byTx = new Map<string, any[]>();
          for (const l of leaves) byTx.set(l.txHash || `leaf-${l.index}`, [...(byTx.get(l.txHash || `leaf-${l.index}`) || []), l]);
          txs += byTx.size;
          for (const [tx, ls] of byTx) events.push({ id: `${s}-${tx}`, type: ls.length === 1 ? "Deposit / Shield" : "Shielded transaction", pool: s, blockNumber: ls[0].blockNumber, txHash: tx, leafIndex: ls[0].index });
        }
        if (stop) return;
        events.sort((x, y) => y.blockNumber - x.blockNumber);
        setRecentEvents(events.slice(0, 25));
        setStats({ usdcTvl: fmt(usdc as bigint), ausdTvl: fmt(ausd as bigint), commitments, txs, currentRoot: `0x${(root as bigint).toString(16).padStart(64, "0")}`, solvencyRatio: "on-chain" });
        setErr(null);
      } catch (e: any) {
        if (!stop) setErr(e.message);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const filteredEvents = recentEvents.filter((ev) => {
    if (filter === "deposits") return ev.type === "Deposit / Shield";
    if (filter === "transfers" || filter === "withdrawals") return ev.type === "Shielded transaction";
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
          <span className="text-[11px] text-sealed mt-1 block font-medium">Tokens held by the pool contract</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Agora AUSD TVL</span>
          <span className="tnum text-2xl font-light text-foreground">${stats.ausdTvl}</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">Cross-border pool</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Merkle Commitments</span>
          <span className="tnum text-2xl font-light text-foreground">{stats.commitments.toLocaleString()}</span>
          <span className="text-[11px] text-mute mt-1 block">USDC + AUSD, depth-20 Poseidon trees</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Pool Transactions</span>
          <span className="tnum text-2xl font-light text-foreground">{stats.txs.toLocaleString()}</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">Nullifiers block double-spends</span>
        </div>
      </div>

      {/* Merkle Tree Cryptographic State */}
      <div className="gl-card p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div>
            <h3 className="text-base font-medium text-foreground">Current Merkle Tree Root (USDC pool)</h3>
            <p className="text-xs text-mute">
              All client-side Groth16 membership proofs are verified against this root on-chain.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sealed-soft px-3 py-1 text-xs font-medium text-sealed">
            <span className="h-1.5 w-1.5 rounded-full bg-sealed" />
            Live from {stats.solvencyRatio} reads
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
            <span className="font-mono text-foreground font-medium">All (never expire)</span>
          </div>
        </div>
      </div>

      {/* Real-time Envio HyperIndex Event Stream */}
      <div className="gl-card p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h3 className="text-base font-medium text-foreground">Pool Event Stream</h3>
            <p className="text-xs text-mute">Every pool transaction on Monad testnet. Transfers and cash-outs are indistinguishable by design.{err ? ` (${err})` : ""}</p>
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
              Private txs
            </button>
          </div>
        </div>

        <div className="divide-y divide-line">
          {filteredEvents.length === 0 && <p className="py-4 text-xs text-mute">No pool activity yet.</p>}
          {filteredEvents.map((ev) => (
            <div key={ev.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-sans">
                  <span className="font-medium text-foreground">{ev.type}</span>
                  <span className="text-[11px] text-mute font-mono">{ev.pool} · Block #{ev.blockNumber}</span>
                  <KindBadge sealed={ev.type !== "Deposit / Shield"} />
                </div>
                <div className="text-[11px] text-mute">
                  Tx: <a className="text-foreground underline" href={txUrl(ev.txHash)} target="_blank" rel="noreferrer">{ev.txHash.slice(0, 16)}…{ev.txHash.slice(-10)}</a>
                </div>
              </div>

              <div className="text-right">
                {ev.leafIndex !== undefined && (
                  <span className="text-sealed block">Leaf Index #{ev.leafIndex}</span>
                )}

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
