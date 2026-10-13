"use client";

import { txUrl } from "@/lib/config";

export function StatusBox({ status, error, txHash }: { status: string; error: string; txHash?: string | null }) {
  return (
    <>
      {error && <div className="text-danger text-xs mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl break-words">{error}</div>}
      {status && (
        <div className="text-sealed text-xs mb-4 p-3 bg-sealed-soft border border-sealed/20 rounded-xl flex items-center gap-2">
          {status !== "Done" && <span className="w-3.5 h-3.5 shrink-0 border-2 border-sealed border-t-transparent rounded-full animate-spin" />}
          <span className="break-words">{status}</span>
        </div>
      )}
      {txHash && (
        <a href={txUrl(txHash)} target="_blank" rel="noreferrer" className="block text-xs text-mute underline mb-4 font-mono truncate">
          View transaction {txHash.slice(0, 18)}…
        </a>
      )}
    </>
  );
}

export function AssetToggle({ asset, setAsset }: { asset: "USDC" | "AUSD"; setAsset: (a: "USDC" | "AUSD") => void }) {
  return (
    <div className="inline-flex rounded-full bg-surface p-1 mb-4">
      {(["USDC", "AUSD"] as const).map((a) => (
        <button key={a} type="button" onClick={() => setAsset(a)}
          className={`h-8 rounded-full px-4 text-xs transition-colors ${asset === a ? "bg-panel font-medium text-foreground shadow-card" : "text-mute hover:text-foreground"}`}>
          {a}
        </button>
      ))}
    </div>
  );
}
