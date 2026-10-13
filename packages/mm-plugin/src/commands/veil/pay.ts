import { Command, Flags } from "@oclif/core";
import { parseUnits } from "viem";
import { getAgentKeys } from "../../keys.js";
import { checkGuard } from "../../guard.js";
import { nodeProver, poolClient } from "../../veil.js";

export default class PayCommand extends Command {
  static description = "Send a private payment to another veil: address (within the owner's guard policy)";

  static flags = {
    to: Flags.string({ description: "Recipient veil: address", required: true }),
    amount: Flags.string({ description: "Amount (e.g. 1.5)", required: true }),
    pool: Flags.string({ description: "Pool symbol (USDC or AUSD)", default: "USDC" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(PayCommand);
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");
    const wallet = ctx.session.account;
    const amount = parseUnits(flags.amount, 6);
    if (amount <= 0n) throw new Error("Amount must be > 0");

    this.log("Checking guard policy...");
    checkGuard(wallet, flags.amount, flags.to); // throws if denied

    const keys = await getAgentKeys(ctx, flags["chain-id"]);
    const c = poolClient(flags["chain-id"], flags.pool, keys);
    const txHash = await c.send(flags.to, amount, nodeProver(), (m) => this.log(m));
    this.log(`Private transfer sent: ${txHash}`);
    return { status: "success", txHash };
  }
}
