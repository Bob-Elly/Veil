"use client";

import { useState } from "react";
import { useApp } from "./Providers";
import { POOLS } from "@/lib/config";
import { createClaimTarget, parseAmount } from "@/lib/veil";
import { getProver } from "@/lib/prover";
import { AssetToggle, StatusBox } from "./ModalShell";

export function SendModal({ onClose }: { onClose: () => void }) {
  const { session, asset, setAsset, client, triggerSync } = useApp();
  const [address, setAddress] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState<string | null>(null);

  const handleSend = async () => {
    const c = client(asset);
    if (!session || !c) return;
    try {
      setError(""); setTxHash(null); setClaimLink(null);
      const amount = parseAmount(amountStr, POOLS[asset].decimals);
      let to = address.trim();
      let link: string | null = null;
      if (!to.startsWith("veil:")) {
        const claim = await createClaimTarget();
        to = claim.address; link = claim.link;
      }
      setStatus("Loading prover…");
      const prover = await getProver();
      const hash = await c.send(to, amount, prover, setStatus);
      setTxHash(hash);
      setClaimLink(link);
      await triggerSync();
      setStatus("Done");
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 rise">
      <div className="gl-panel bg-panel border border-line-strong p-7 rounded-[20px] w-full max-w-md shadow-[var(--shadow-pop)] relative">
        <h2 className="text-xl font-light text-foreground mb-1">Send privately</h2>
        <p className="text-xs text-mute mb-4">Sender, recipient and amount stay hidden on-chain.</p>
        <AssetToggle asset={asset} setAsset={setAsset} />

        <div className="mb-4">
          <label className="block text-xs font-medium text-mute mb-1.5">Recipient veil: address (leave a name or email to create a claim link)</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="gl-input font-mono text-xs" placeholder="veil:0x… or alice@example.com" />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-mute mb-1.5">Amount</label>
          <div className="relative">
            <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="gl-input text-lg pr-16" placeholder="0.00" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-mute">{asset}</span>
          </div>
        </div>

        <StatusBox status={status} error={error} txHash={txHash} />
        {claimLink && (
          <div className="text-xs mb-4 p-3 rounded-xl bg-surface">
            <div className="text-mute mb-1">Send this claim link to the recipient (anyone with it can claim the funds):</div>
            <input readOnly value={claimLink} onFocus={(e) => e.target.select()} className="gl-input font-mono text-[11px]" />
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">{status === "Done" ? "Close" : "Cancel"}</button>
          <button type="button" onClick={handleSend} disabled={(!!status && status !== "Done") || !amountStr || !address} className="btn btn-ink flex-1">Send</button>
        </div>
      </div>
    </div>
  );
}
