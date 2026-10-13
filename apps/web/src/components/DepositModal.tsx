"use client";

import { useEffect, useState } from "react";
import { useApp } from "./Providers";
import { POOLS } from "@/lib/config";
import { ensureGas, fmt, mintTestTokens, parseAmount, publicTokenBalance, walletClientFor } from "@/lib/veil";
import { AssetToggle, StatusBox } from "./ModalShell";

export function DepositModal({ onClose }: { onClose: () => void }) {
  const { session, asset, setAsset, client, triggerSync } = useApp();
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [publicBal, setPublicBal] = useState<bigint | null>(null);

  const refreshPublic = async () => {
    if (!session) return;
    try { setPublicBal(await publicTokenBalance(asset, session.publicAccount.address)); } catch { setPublicBal(null); }
  };
  useEffect(() => { refreshPublic(); }, [session, asset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeposit = async () => {
    const c = client(asset);
    if (!session || !c) return;
    try {
      setError(""); setTxHash(null);
      const amount = parseAmount(amountStr, POOLS[asset].decimals);
      await ensureGas(session, setStatus);
      const hash = await c.deposit(walletClientFor(session), amount, setStatus);
      setTxHash(hash);
      await triggerSync();
      setStatus("Done");
      refreshPublic();
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message);
      setStatus("");
    }
  };

  const handleMint = async () => {
    if (!session) return;
    try {
      setError("");
      await ensureGas(session, setStatus);
      setStatus(`Minting 100 test ${asset}…`);
      await mintTestTokens(session, asset, 100_000_000n);
      setStatus("");
      refreshPublic();
    } catch (e: any) {
      setError(e.shortMessage || e.message);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="gl-panel bg-panel border border-line p-7 rounded-[24px] w-full max-w-md shadow-card relative">
        <h2 className="text-xl font-light text-foreground mb-1">Add {asset} privately</h2>
        <p className="text-xs text-mute mb-4">Move funds from your passkey wallet into your private balance.</p>
        <AssetToggle asset={asset} setAsset={setAsset} />

        {session && (
          <div className="text-[11px] text-mute mb-4 p-3 rounded-xl bg-surface space-y-1">
            <div>Funding wallet: <span className="font-mono break-all text-foreground">{session.publicAccount.address}</span></div>
            <div>Holds: <span className="text-foreground">{publicBal === null ? "…" : fmt(publicBal)} {asset}</span>
              {POOLS[asset].mintable && <button type="button" onClick={handleMint} className="ml-2 underline">mint 100 test {asset}</button>}
              {asset === "USDC" && <a className="ml-2 underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">USDC faucet</a>}
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs font-medium text-mute mb-1.5">Amount to shield</label>
          <div className="relative">
            <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="gl-input text-lg pr-16" placeholder="0.00" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-mute">{asset}</span>
          </div>
        </div>

        <StatusBox status={status} error={error} txHash={txHash} />

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">{status === "Done" ? "Close" : "Cancel"}</button>
          <button type="button" onClick={handleDeposit} disabled={(!!status && status !== "Done") || !amountStr} className="btn btn-ink flex-1">Deposit</button>
        </div>
      </div>
    </div>
  );
}
