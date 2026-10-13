"use client";

import { Veiled } from "@/components/ui/Veiled";

const PAYMENTS = [
  { label: "Salary", to: "alice.veil", amount: "4,800.00", asset: "USDC" },
  { label: "KOL stream", to: "@cryptokid", amount: "2,130.00", asset: "USDC" },
  { label: "Invoice 0142", to: "studio-kris", amount: "1,250.00", asset: "AUSD" },
  { label: "API calls", to: "research-agent", amount: "0.01", asset: "USDC" },
];

/** Same four payments, as the public explorer sees them and as you do. Hover a row to peek. */
export function ExplorerCard({ explorer, setExplorer }: { explorer: boolean; setExplorer: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-black/55 backdrop-blur-xl shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="text-[13px] text-soft">Recent payments</span>
        <div className="relative flex rounded-lg bg-surface p-0.5 text-[12px]">
          <span className="absolute inset-y-0.5 w-[calc(50%-2px)] rounded-md bg-panel ring-1 ring-line transition-transform duration-500" style={{ transform: explorer ? "translateX(0)" : "translateX(100%)", transitionTimingFunction: "var(--ease)" }} />
          <button onClick={() => setExplorer(true)} className={`relative z-10 px-3 py-1 transition-colors ${explorer ? "text-foreground" : "text-mute"}`}>Explorer</button>
          <button onClick={() => setExplorer(false)} className={`relative z-10 px-3 py-1 transition-colors ${!explorer ? "text-foreground" : "text-mute"}`}>You</button>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {PAYMENTS.map((p, i) => (
          <li key={p.label} className="veil-hover flex items-center justify-between gap-4 px-5 py-4 cursor-default transition-colors duration-300 hover:bg-white/[0.02]">
            <div className="min-w-0">
              <div className="text-[14px] text-foreground">{p.label}</div>
              <div className="mt-0.5 text-[12px] text-mute">to <Veiled open={!explorer} mode="group" delay={i * 0.5}><span>{p.to}</span></Veiled></div>
            </div>
            <div className="text-right">
              <Veiled open={!explorer} mode="group" delay={i * 0.5 + 0.25}><span className="tnum text-[16px] text-foreground">{p.amount}</span></Veiled>
              <div className="mt-0.5 text-[11px] text-faint">{p.asset}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[11px] text-faint">
        <span>{explorer ? "What anyone on MonadVision sees" : "Only you can open these"}</span>
        <span className="font-mono">Groth16 · BN254</span>
      </div>
    </div>
  );
}
