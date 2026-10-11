import { Command, Flags } from "@oclif/core";

export default class WithdrawCommand extends Command {
  static description = "Withdraw funds from the shielded pool to a public address";

  static flags = {
    to: Flags.string({ description: "Recipient public address", required: true }),
    amount: Flags.string({ description: "Amount in USDC", required: true }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    this.log("Withdrawal relaying is unimplemented in this demo.");
    return { status: "unimplemented" };
  }
}
