import { Command, Flags } from "@oclif/core";
import { getAgentKeys } from "../../keys.js";
import { syncNotes } from "../../../../../apps/web/src/lib/sync.js"; // Reuse the sync logic we built
import { readAgentKey } from "../../state.js";
import { formatAddress } from "@veil/sdk/dist/address.js";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // USDC pool testnet

export default class BalanceCommand extends Command {
  static description = "Check the shielded balance for the connected wallet's agent";

  static flags = {
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(BalanceCommand);
    const chainId = flags["chain-id"];
    
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    this.log("Authenticating agent key...");
    const keys = await getAgentKeys(ctx, chainId);
    
    this.log("Syncing from Envio indexer...");
    const result = await syncNotes(POOL_ADDRESS, keys, [], 0n, 0n);
    
    const balance = result.notes.reduce((a, b) => a + (b.spent ? 0n : b.amount), 0n);
    const formattedBalance = (Number(balance) / 1000000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    this.log(`\nAddress: ${formatAddress(keys)}`);
    this.log(`Balance: ${formattedBalance} USDC`);

    return { status: "success", balance: String(balance), address: formatAddress(keys) };
  }
}
