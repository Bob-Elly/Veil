import { Command, Flags } from "@oclif/core";
import { formatUnits } from "viem";
import { getAgentKeys } from "../../keys.js";
import { poolClient } from "../../veil.js";

export default class ReceiptCommand extends Command {
  static description = "Print shareable receipts (note openings) for the agent's notes; verify them at /verify";

  static flags = {
    pool: Flags.string({ description: "Pool symbol (USDC or AUSD)", default: "USDC" }),
    index: Flags.integer({ description: "Only the note at this leaf index" }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(ReceiptCommand);
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");
    const keys = await getAgentKeys(ctx, flags["chain-id"]);
    const c = poolClient(flags["chain-id"], flags.pool, keys);
    await c.sync();
    const receipts = c.notes
      .filter((n) => flags.index === undefined || n.index === flags.index)
      .map((n) => ({ chainId: flags["chain-id"], pool: c.pool.address, index: n.index, commitment: n.commitment.toString(), amount: n.amount.toString(), pubKey: n.pubKey.toString(), blinding: n.blinding.toString(), spent: n.spent }));
    for (const r of receipts) this.log(`#${r.index}  ${formatUnits(BigInt(r.amount), c.pool.decimals)} ${c.pool.symbol}${r.spent ? " (spent)" : ""}\n${JSON.stringify(r)}\n`);
    return { status: "success", receipts };
  }
}
