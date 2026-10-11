import { Command } from "@oclif/core";

export default class SkillCommand extends Command {
  static description = "Print the SKILL.md instructions for agents using this plugin";

  async run() {
    this.log("SKILL.md generation unimplemented in this demo.");
    return { status: "unimplemented" };
  }
}
