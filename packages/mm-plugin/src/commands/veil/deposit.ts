import { Command, Flags } from "@oclif/core";
import { encodeFunctionData, erc20Abi, parseUnits, toHex } from "viem";
import { randomBytes } from "crypto";
import { encryptNote } from "@veil/sdk";
import { getAgentKeys } from "../../keys.js";
import { deployments } from "../../veil.js";

const DEPOSIT_TO_ABI = [{
  type: "function", name: "depositTo", stateMutability: "nonpayable",
  inputs: [{ name: "pubKey", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "blinding", type: "uint256" }, { name: "encryptedOutput", type: "bytes" }],
  outputs: [{ type: "uint256" }, { type: "uint32" }],
}] as const;

export default class DepositCommand extends Command {
  static description = "Fund the agent's private balance from the MetaMask wallet (approve + depositTo, policy-checked by mm)";

  static flags = {
    amount: Flags.string({ description: "Amount (e.g. 10)", required: true }),
    pool: Flags.string({ description: "Pool symbol (USDC or AUSD)", default: "USDC" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(DepositCommand);
    const chainId = flags["chain-id"];
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");
    const pool = deployments(chainId).pools[flags.pool.toUpperCase()];
    if (!pool) throw new Error(`No ${flags.pool} pool on chain ${chainId}`);
    const amount = parseUnits(flags.amount, pool.decimals);
    if (amount <= 0n) throw new Error("Amount must be > 0");

    const keys = await getAgentKeys(ctx, chainId);

    this.log(`Approving ${flags.pool} via MetaMask...`);
    const approve = await ctx.walletExecutor(this, "veil:deposit", {
      kind: "transaction",
      transaction: { to: pool.token, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [pool.address, amount] }), value: "0x0" },
    });
    if (approve.status === "AWAITING_MFA") { this.log("Awaiting MFA approval for the allowance."); return { status: "AWAITING_MFA" }; }

    // depositTo: no proof needed; the pool computes the commitment on-chain.
    const blinding = BigInt(toHex(randomBytes(31)));
    const memo = encryptNote(keys.encPub, amount, blinding) as `0x${string}`;
    this.log("Depositing into the Veil pool via MetaMask...");
    const res = await ctx.walletExecutor(this, "veil:deposit", {
      kind: "transaction",
      transaction: { to: pool.address, data: encodeFunctionData({ abi: DEPOSIT_TO_ABI, functionName: "depositTo", args: [keys.pubKey, amount, blinding, memo] }), value: "0x0" },
    });
    this.log(`Deposit sent: ${res.transactionHash}`);
    return { status: "success", txHash: res.transactionHash };
  }
}
