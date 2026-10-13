import { Command, Flags } from "@oclif/core";
import { formatUnits } from "viem";
import { formatAddress } from "@veil/sdk";
import { getAgentKeys } from "../../keys.js";
import { poolClient } from "../../veil.js";

export default class BalanceCommand extends Command {
  static description = "Show the agent's private (shielded) balance";

  static flags = {
    pool: Flags.string({ description: "Pool symbol (USDC or AUSD)", default: "USDC" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(BalanceCommand);
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");
    const keys = await getAgentKeys(ctx, flags["chain-id"]);
    const c = poolClient(flags["chain-id"], flags.pool, keys);
    this.log("Syncing pool...");
    await c.sync();
    this.log(`\nAddress: ${formatAddress(keys)}\nBalance: ${formatUnits(c.balance, c.pool.decimals)} ${c.pool.symbol} (${c.unspent.length} notes)`);
    return { status: "success", balance: c.balance.toString(), notes: c.unspent.length, address: formatAddress(keys) };
  }
}
