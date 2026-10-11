import { Command, Flags } from "@oclif/core";
import { writeGuard, readGuard, GuardState } from "../../../guard.js";

export default class GuardSetCommand extends Command {
  static description = "Set the spend guard policy for the agent";

  static flags = {
    "per-payment": Flags.string({ description: "Per-payment cap in USDC", required: true }),
    daily: Flags.string({ description: "Daily cap in USDC", required: true }),
    allow: Flags.string({ description: "Comma-separated allowlist of Veil addresses", default: "" }),
    expires: Flags.string({ description: "Expiration date (YYYY-MM-DD)", required: true }),
  };

  async run() {
    const { flags } = await this.parse(GuardSetCommand);
    
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const wallet = ctx.session.account;
    const existing = readGuard(wallet);
    
    const state: GuardState = {
        policy: {
            perPayment: flags["per-payment"],
            daily: flags.daily,
            allow: flags.allow ? flags.allow.split(",") : [],
            expires: flags.expires
        },
        log: existing ? existing.log : []
    };

    writeGuard(wallet, state);
    this.log(`Guard policy updated for ${wallet}`);
    
    return { status: "success", policy: state.policy };
  }
}
