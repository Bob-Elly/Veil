"use client";

import { useState } from "react";
import { useApp } from "./Providers";
import { parseUnits, createWalletClient, http, custom, erc20Abi, encodeFunctionData, parseAbiItem, publicActions } from "viem";
import { monadTestnet } from "viem/chains";
import { buildDeposit, MerkleTree } from "@veil/sdk";
import { getProver } from "@/lib/prover";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // USDC pool testnet
const TOKEN_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3"; // USDC testnet token
const DECIMALS = 6;

const transactAbi = [
  parseAbiItem("function transact((uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 publicAmount, uint256 extDataHash, uint256[2] inputNullifiers, uint256[2] outputCommitments) proof, (address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2) extData) external")
];

export function DepositModal({ onClose }: { onClose: () => void }) {
  const { session } = useApp();
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleDeposit = async () => {
    if (!session) return;
    try {
      setError("");
      setStatus("Generating proof...");
      
      const amount = parseUnits(amountStr, DECIMALS);
      if (amount <= 0n) throw new Error("Amount must be greater than 0");

      const prover = await getProver();
      // For deposit into empty tree (simplification for UI component. Full app would sync first)
      const tree = new MerkleTree();
      
      const { proofArgs, extData } = await buildDeposit(amount, session.keys.main, tree, prover);

      setStatus("Approving USDC...");
      
      const client = createWalletClient({
        account: session.publicAccount,
        chain: monadTestnet,
        transport: http("https://testnet-rpc.monad.xyz/")
      }).extend(publicActions);

      const approveGas = await client.estimateContractGas({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [POOL_ADDRESS, amount],
        account: session.publicAccount
      });

      const approveTx = await client.writeContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [POOL_ADDRESS, amount],
        gas: (approveGas * 115n) / 100n
      });

      setStatus("Waiting for approval...");
      await client.waitForTransactionReceipt({ hash: approveTx });

      setStatus("Depositing to pool...");
      
      const args = [
        proofArgs,
        {
          recipient: extData.recipient as `0x${string}`,
          extAmount: extData.extAmount,
          relayer: extData.relayer as `0x${string}`,
          fee: extData.fee,
          encryptedOutput1: extData.encryptedOutput1 as `0x${string}`,
          encryptedOutput2: extData.encryptedOutput2 as `0x${string}`
        }
      ] as any;

      const transactGas = await client.estimateContractGas({
        address: POOL_ADDRESS,
        abi: transactAbi,
        functionName: "transact",
        args,
        account: session.publicAccount
      });

      const depositTx = await client.writeContract({
        address: POOL_ADDRESS,
        abi: transactAbi,
        functionName: "transact",
        args,
        gas: (transactGas * 115n) / 100n
      });

      setStatus("Waiting for confirmation...");
      await client.waitForTransactionReceipt({ hash: depositTx });

      setStatus("Success!");
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
        <h2 className="text-2xl font-bold mb-6">Deposit USDC</h2>
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
            onClick={handleDeposit}
            disabled={!!status || !amountStr}
            className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            Deposit
          </button>
        </div>
      </div>
    </div>
  );
}
