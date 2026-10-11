import { Command } from "@oclif/core";

export default class ReceiptCommand extends Command {
  static description = "View and export your Veil Agent Key backup";

  async run() {
    this.log("Backup view unimplemented in this demo.");
    return { status: "unimplemented" };
  }
}
