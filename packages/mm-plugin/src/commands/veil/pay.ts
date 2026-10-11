import { Command, Flags } from "@oclif/core";
import { getAgentKeys } from "../../keys.js";
import { getNodeProver } from "../../prover.js";
import { checkGuard } from "../../guard.js";
import { MerkleTree } from "@veil/sdk/dist/tree.js";
import { buildTransfer } from "@veil/sdk/dist/tx.js";
import { selectInputs } from "@veil/sdk/dist/coinSelect.js";
import { syncNotes } from "../../../../../apps/web/src/lib/sync.js"; 
import { submitToRelayer } from "../../../../../apps/web/src/lib/relayer.js";
import { parseUnits } from "viem";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; 
const DECIMALS = 6;
const RELAYER_ADDRESS = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";

export default class PayCommand extends Command {
  static description = "Send a private payment to another Veil address";

  static flags = {
    to: Flags.string({ description: "Recipient veil address", required: true }),
    amount: Flags.string({ description: "Amount in USDC", required: true }),
    pool: Flags.string({ description: "Pool symbol (USDC)", default: "USDC" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(PayCommand);
    const chainId = flags["chain-id"];
    
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const wallet = ctx.session.account;
    const amountStr = flags.amount;
    const amount = parseUnits(amountStr, DECIMALS);

    if (amount <= 0n) throw new Error("Amount must be > 0");

    this.log("Checking guard policy...");
    // Will throw if guard denies
    checkGuard(wallet, amountStr, flags.to);

    this.log("Authenticating agent key...");
    const keys = await getAgentKeys(ctx, chainId);

    this.log("Syncing notes...");
    const { notes } = await syncNotes(POOL_ADDRESS, keys, [], 0n, 0n);
    const available = notes.filter(n => !n.spent);

    this.log("Selecting inputs...");
    const selection = selectInputs(available, amount);
    if (selection.needsMerge) {
        throw new Error("Needs merge - combine balances first (Not implemented in demo)");
    }

    this.log("Generating ZK Proof locally...");
    const prover = await getNodeProver();
    const tree = new MerkleTree();
    for (const n of notes) await tree.insert(n.commitment!); 
    
    const { proofArgs, extData } = await buildTransfer(flags.to, amount, 0n, RELAYER_ADDRESS, selection.inputs, keys, tree, prover);
    
    this.log("Submitting to relayer...");
    const relayRes = await submitToRelayer(POOL_ADDRESS, proofArgs, extData);

    this.log(`Transfer sent! Tx: ${relayRes.txHash}`);
    return { status: "success", txHash: relayRes.txHash };
  }
}
