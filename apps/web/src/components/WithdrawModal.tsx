"use client";

import { useState } from "react";
import { useApp } from "./Providers";
import { parseUnits, isAddress } from "viem";
import { buildWithdraw, selectInputs, MerkleTree } from "@veil/sdk";
import { getProver } from "@/lib/prover";
import { submitToRelayer } from "@/lib/relayer";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // USDC pool testnet
const DECIMALS = 6;
const RELAYER_ADDRESS = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50"; // Use dynamic fetch via /status in real app

export function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { session, notes, triggerSync } = useApp();
  const [address, setAddress] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleWithdraw = async () => {
    if (!session) return;
    try {
      setError("");
      setStatus("Selecting inputs...");
      
      const amount = parseUnits(amountStr, DECIMALS);
      if (amount <= 0n) throw new Error("Amount must be greater than 0");
      if (!isAddress(address)) throw new Error("Invalid public address");

      const availableNotes = notes.filter(n => !n.spent);
      const selection = selectInputs(availableNotes, amount);
      
      if (selection.needsMerge) {
          throw new Error("Needs merge - combine balances first (Not implemented in demo)");
      }

      setStatus("Generating ZK proof...");
      
      const prover = await getProver();
      // For deposit into empty tree (simplification for UI component. Full app would sync first)
      const tree = new MerkleTree();
      for (const n of notes) await tree.insert(n.commitment!); 

      const { proofArgs, extData } = await buildWithdraw(
          address, 
          amount, 
          0n, // fee 
          RELAYER_ADDRESS, 
          selection.inputs, 
          session.keys.main, 
          tree, 
          prover
      );

      setStatus("Submitting to Relayer...");
      
      await submitToRelayer(POOL_ADDRESS, proofArgs, extData);

      setStatus("Success!");
      triggerSync(); // Optimistic sync
      setTimeout(onClose, 2000);
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="gl-panel bg-panel border border-line p-7 rounded-[24px] w-full max-w-md shadow-card relative">
        <h2 className="text-xl font-light text-foreground mb-1">Cash Out to Public Wallet</h2>
        <p className="text-xs text-mute mb-5">Unshield funds from the pool directly to any standard Monad address.</p>
        
        <div className="mb-4">
          <label className="block text-xs font-medium text-mute mb-1.5">Recipient Public Address</label>
          <input 
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="gl-input font-mono text-xs"
            placeholder="0x..."
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-mute mb-1.5">Amount</label>
          <div className="relative">
            <input 
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="gl-input text-lg pr-16"
              placeholder="0.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-mute">USDC</span>
          </div>
        </div>

        {error && <div className="text-danger text-xs mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">{error}</div>}
        {status && <div className="text-sealed text-xs mb-4 p-3 bg-sealed-soft border border-sealed/20 rounded-xl flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-sealed border-t-transparent rounded-full animate-spin" />
          {status}
        </div>}

        <div className="flex gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="btn btn-ghost flex-1"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleWithdraw}
            disabled={!!status || !amountStr || !address}
            className="btn btn-ink flex-1"
          >
            Cash Out
          </button>
        </div>
      </div>
    </div>
  );
}
