import { Command, Flags } from "@oclif/core";
import { getAgentKeys } from "../../keys.js";
import { getNodeProver } from "../../prover.js";
import { MerkleTree } from "@veil/sdk/dist/tree.js";
import { buildDeposit } from "@veil/sdk/dist/tx.js";
import { parseUnits, encodeFunctionData, parseAbiItem, erc20Abi } from "viem";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; 
const TOKEN_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const DECIMALS = 6;

const transactAbi = [
  parseAbiItem("function transact((uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 publicAmount, uint256 extDataHash, uint256[2] inputNullifiers, uint256[2] outputCommitments) proof, (address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2) extData) external")
];

export default class DepositCommand extends Command {
  static description = "Deposit funds into the shielded pool using MetaMask policy";

  static flags = {
    amount: Flags.string({ description: "Amount in USDC", required: true }),
    pool: Flags.string({ description: "Pool symbol (USDC)", default: "USDC" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(DepositCommand);
    const chainId = flags["chain-id"];
    
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const amount = parseUnits(flags.amount, DECIMALS);
    if (amount <= 0n) throw new Error("Amount must be > 0");

    this.log("Authenticating agent key...");
    const keys = await getAgentKeys(ctx, chainId);

    this.log("Generating ZK Proof locally...");
    const prover = await getNodeProver();
    const tree = new MerkleTree();
    
    const { proofArgs, extData } = await buildDeposit(amount, keys, tree, prover);
    
    this.log("Submitting USDC approve via MetaMask...");
    
    const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [POOL_ADDRESS as any, amount]
    });

    const resApprove = await ctx.walletExecutor(this, "veil:deposit", {
        kind: "transaction",
        transaction: {
            to: TOKEN_ADDRESS,
            data: approveData,
            value: "0x0"
        }
    });

    if (resApprove.status === "AWAITING_MFA") {
        this.log("Awaiting MFA approval for USDC allowance.");
        return { status: "AWAITING_MFA" };
    }

    this.log(`Approval sent: ${resApprove.transactionHash}`);

    this.log("Submitting VeilPool transact via MetaMask...");

    const transactData = encodeFunctionData({
        abi: transactAbi,
        functionName: "transact",
        args: [
            proofArgs,
            {
                recipient: extData.recipient,
                extAmount: extData.extAmount,
                relayer: extData.relayer,
                fee: extData.fee,
                encryptedOutput1: extData.encryptedOutput1,
                encryptedOutput2: extData.encryptedOutput2
            }
        ]
    });

    const resTransact = await ctx.walletExecutor(this, "veil:deposit", {
        kind: "transaction",
        transaction: {
            to: POOL_ADDRESS,
            data: transactData,
            value: "0x0"
        }
    });

    this.log(`Deposit sent: ${resTransact.transactionHash}`);
    return { status: "success", txHash: resTransact.transactionHash };
  }
}
