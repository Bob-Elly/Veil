import { Command } from "@oclif/core";
import { readGuard } from "../../../guard.js";

export default class GuardGetCommand extends Command {
  static description = "Get the spend guard policy for the agent";

  async run() {
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const wallet = ctx.session.account;
    const existing = readGuard(wallet);
    
    if (!existing) {
        this.log("No guard policy set.");
        return { status: "not_set" };
    }

    this.log(JSON.stringify(existing.policy, null, 2));
    
    return { status: "success", policy: existing.policy };
  }
}
