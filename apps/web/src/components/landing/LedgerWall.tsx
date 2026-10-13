"use client";

import { useMemo } from "react";

/** A tilted wall of public ledger rows. Everything is visible except what matters. */
export function LedgerWall() {
  const rows = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("");
    return Array.from({ length: 34 }, (_, i) => ({
      tx: `0x${hex(4)}…${hex(4)}`,
      block: (70583000 + i * 3 + Math.floor(rnd() * 3)).toLocaleString("en-US"),
      w1: 3 + Math.floor(rnd() * 5),
      w2: 4 + Math.floor(rnd() * 6),
      kind: rnd() > 0.72 ? "depositTo()" : "transact()",
      lit: i % 9 === 4,
    }));
  }, []);

  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <div className="flex items-center gap-6 whitespace-nowrap py-[9px] border-b border-white/[0.04]">
      <span className="text-white/25 w-[110px]">{r.tx}</span>
      <span className="text-white/35 w-[96px]">{r.kind}</span>
      <span className="relative inline-block h-[14px] rounded-[2px] bg-black ring-1 ring-white/[0.07]" style={{ width: `${r.w1 * 14}px` }}>
        {r.lit && <span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-accent shadow-[0_0_18px_4px_rgba(131,110,249,0.55)]" style={{ animation: "veil-pulse 4s infinite" }} />}
      </span>
      <span className="inline-block h-[14px] rounded-[2px] bg-black ring-1 ring-white/[0.07]" style={{ width: `${r.w2 * 12}px` }} />
      <span className="text-white/20">#{r.block}</span>
    </div>
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -right-[12%] -top-[8%] h-[130%] w-[85%] font-mono text-[12px]"
        style={{
          transform: "perspective(1400px) rotateX(22deg) rotateY(-28deg) rotateZ(6deg)",
          maskImage: "radial-gradient(70% 60% at 60% 45%, #000 35%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 60% 45%, #000 35%, transparent 80%)",
        }}
      >
        <div style={{ animation: "ledger-scroll 60s linear infinite" }}>
          {[...rows, ...rows].map((r, i) => <Row key={i} r={r} />)}
        </div>
      </div>
      <style>{`@keyframes ledger-scroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}`}</style>
    </div>
  );
}
