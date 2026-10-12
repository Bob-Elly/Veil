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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="gl-panel bg-panel border border-line p-7 rounded-[24px] w-full max-w-md shadow-card relative">
        <h2 className="text-xl font-light text-foreground mb-1">Add USDC Privately</h2>
        <p className="text-xs text-mute mb-5">Move funds from your wallet into your private shielded balance.</p>

        <div className="mb-5">
          <label className="block text-xs font-medium text-mute mb-1.5">Amount to Shield</label>
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
            onClick={handleDeposit}
            disabled={!!status || !amountStr}
            className="btn btn-ink flex-1"
          >
            Deposit
          </button>
        </div>
      </div>
    </div>
  );
}
