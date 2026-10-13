"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { useApp } from "./Providers";
import { POOLS } from "@/lib/config";
import { parseAmount } from "@/lib/veil";
import { getProver } from "@/lib/prover";
import { AssetToggle, StatusBox } from "./ModalShell";

export function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { session, asset, setAsset, client, triggerSync } = useApp();
  const [address, setAddress] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleWithdraw = async () => {
    const c = client(asset);
    if (!session || !c) return;
    try {
      setError(""); setTxHash(null);
      const amount = parseAmount(amountStr, POOLS[asset].decimals);
      if (!isAddress(address.trim())) throw new Error("Enter a valid 0x address");
      setStatus("Loading prover…");
      const prover = await getProver();
      const hash = await c.withdraw(address.trim(), amount, prover, setStatus);
      setTxHash(hash);
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
        <h2 className="text-xl font-light text-foreground mb-1">Cash out to a public wallet</h2>
        <p className="text-xs text-mute mb-4">Unshield to any Monad address. The relayer pays gas, so the address needs no history.</p>
        <AssetToggle asset={asset} setAsset={setAsset} />

        <div className="mb-4">
          <label className="block text-xs font-medium text-mute mb-1.5">Recipient public address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="gl-input font-mono text-xs" placeholder="0x…" />
          {session && <button type="button" onClick={() => setAddress(session.publicAccount.address)} className="text-[11px] text-mute underline mt-1">use my funding wallet</button>}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-mute mb-1.5">Amount</label>
          <div className="relative">
            <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="gl-input text-lg pr-16" placeholder="0.00" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-mute">{asset}</span>
          </div>
        </div>

        <StatusBox status={status} error={error} txHash={txHash} />

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">{status === "Done" ? "Close" : "Cancel"}</button>
          <button type="button" onClick={handleWithdraw} disabled={(!!status && status !== "Done") || !amountStr || !address} className="btn btn-ink flex-1">Cash out</button>
        </div>
      </div>
    </div>
  );
}
