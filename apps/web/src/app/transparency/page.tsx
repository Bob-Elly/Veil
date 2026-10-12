"use client";

import { KindBadge } from "@/components/ui/SealedField";

export default function TransparencyPage() {
  const stats = {
    usdcTvl: "128,450.00",
    ausdTvl: "74,200.00",
    commitments: 1420,
    nullifiers: 980,
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            System Transparency
          </h1>
          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-mute font-mono">
            Envio HyperIndex
          </span>
        </div>
        <p className="text-sm text-mute max-w-2xl">
          Real-time mathematical auditability and proof-of-reserves without compromising individual user privacy.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">USDC Pool TVL</span>
          <span className="tnum text-2xl font-light text-foreground">${stats.usdcTvl}</span>
          <span className="text-[11px] text-mute mt-1 block">Monad Testnet</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Agora AUSD TVL</span>
          <span className="tnum text-2xl font-light text-foreground">${stats.ausdTvl}</span>
          <span className="text-[11px] text-mute mt-1 block">Cross-border pool</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Merkle Leaves</span>
          <span className="tnum text-2xl font-light text-foreground">{stats.commitments.toLocaleString()}</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">Depth 20 tree</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Spent Nullifiers</span>
          <span className="tnum text-2xl font-light text-foreground">{stats.nullifiers.toLocaleString()}</span>
          <span className="text-[11px] text-mute mt-1 block">Zero double-spends</span>
        </div>
      </div>

      <div className="gl-card p-6">
        <h3 className="text-base font-medium text-foreground mb-4">Verified Contract Deployments</h3>
        <div className="divide-y divide-line text-xs font-mono">
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-mute">USDC Shielded Pool</span>
            <span className="text-foreground">0x57c2502f0522d2128f72ea867d2225fb15aeb1d1</span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-mute">Agora AUSD Shielded Pool</span>
            <span className="text-foreground">0x409b1d63174407550f773d405e4068e147362d18</span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-mute">Groth16 Verifier (BN254)</span>
            <span className="text-foreground">0x6b985d08c0a530b972c9c268d6c220b336abf14c</span>
          </div>
          <div className="py-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-mute">StreamVault Factory</span>
            <span className="text-foreground">0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560</span>
          </div>
        </div>
      </div>
    </div>
  );
}
