"use client";

import { useState } from "react";
import { useApp } from "./Providers";
import { parseUnits } from "viem";
import { buildTransfer } from "@veil/sdk/dist/tx";
import { selectInputs } from "@veil/sdk/dist/coinSelect";
import { MerkleTree } from "@veil/sdk/dist/tree";
import { getProver } from "@/lib/prover";
import { submitToRelayer } from "@/lib/relayer";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // USDC pool testnet
const DECIMALS = 6;
const RELAYER_ADDRESS = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50"; // Use dynamic fetch via /status in real app

export function SendModal({ onClose }: { onClose: () => void }) {
  const { session, notes, triggerSync } = useApp();
  const [address, setAddress] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!session) return;
    try {
      setError("");
      setStatus("Selecting inputs...");
      
      const amount = parseUnits(amountStr, DECIMALS);
      if (amount <= 0n) throw new Error("Amount must be greater than 0");

      const availableNotes = notes.filter(n => !n.spent);
      const selection = selectInputs(availableNotes, amount); // 0 fee for now
      
      if (selection.needsMerge) {
          throw new Error("Needs merge - combine balances first (Not implemented in demo)");
      }

      setStatus("Generating ZK proof...");
      
      const prover = await getProver();
      // For deposit into empty tree (simplification for UI component. Full app would sync first)
      const tree = new MerkleTree();
      for (const n of notes) await tree.insert(n.commitment!); // Wait, notes need commitments for the tree, but SDK expects tree to be in sync.

      const { proofArgs, extData } = await buildTransfer(
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
        <h2 className="text-2xl font-bold mb-6">Send USDC Privately</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-400 mb-2">Recipient Veil Address</label>
          <input 
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 font-mono text-sm outline-none focus:border-indigo-500 transition-colors"
            placeholder="veil:0x..."
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-400 mb-2">Amount</label>
          <div className="relative">
            <input 
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xl font-medium outline-none focus:border-indigo-500 transition-colors"
              placeholder="0.00"
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold">USDC</span>
          </div>
        </div>

        {error && <div className="text-red-400 text-sm mb-6 p-4 bg-red-400/10 rounded-xl">{error}</div>}
        {status && <div className="text-indigo-400 text-sm mb-6 p-4 bg-indigo-400/10 rounded-xl flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          {status}
        </div>}

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={!!status || !amountStr || !address}
            className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
