import { Command, Flags } from "@oclif/core";
import { isAddress, parseUnits } from "viem";
import { getAgentKeys } from "../../keys.js";
import { checkGuard } from "../../guard.js";
import { nodeProver, poolClient } from "../../veil.js";

export default class WithdrawCommand extends Command {
  static description = "Withdraw from the shielded pool to a public address (relayer pays gas)";

  static flags = {
    to: Flags.string({ description: "Recipient public address", required: true }),
    amount: Flags.string({ description: "Amount (e.g. 1.5)", required: true }),
    pool: Flags.string({ description: "Pool symbol (USDC or AUSD)", default: "USDC" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(WithdrawCommand);
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");
    if (!isAddress(flags.to)) throw new Error("--to must be a 0x address");
    const amount = parseUnits(flags.amount, 6);
    checkGuard(ctx.session.account, flags.amount, flags.to);
    const keys = await getAgentKeys(ctx, flags["chain-id"]);
    const c = poolClient(flags["chain-id"], flags.pool, keys);
    const txHash = await c.withdraw(flags.to, amount, nodeProver(), (m) => this.log(m));
    this.log(`Withdrawn: ${txHash}`);
    return { status: "success", txHash };
  }
}
