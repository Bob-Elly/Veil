import { Command, Flags } from "@oclif/core";
import { createCipheriv, randomBytes, scryptSync } from "crypto";
import { keccak256, toBytes } from "viem";
import { VeilKeys, formatAddress } from "@veil/sdk";
import { writeAgentKey } from "../../state.js";
import { agentTypedData } from "../../keys.js";

export default class SetupCommand extends Command {
  static description = "Set up the Veil agent key for the connected wallet";

  static flags = {
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  async run() {
    const { flags } = await this.parse(SetupCommand);
    const chainId = flags["chain-id"];
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");
    const wallet = ctx.session.account;
    const typedData = agentTypedData(chainId, wallet);

    this.log("Requesting signature 1...");
    const sig1 = await ctx.walletExecutor(this, "veil:setup", { kind: "typed-data", typedData });
    this.log("Requesting signature 2 to verify determinism...");
    const sig2 = await ctx.walletExecutor(this, "veil:setup", { kind: "typed-data", typedData });

    let seed: Uint8Array;
    let mode: "derived" | "random";
    if (sig1.signature === sig2.signature) {
      mode = "derived";
      seed = toBytes(keccak256(sig1.signature as `0x${string}`));
      writeAgentKey(wallet, chainId, { mode });
    } else {
      // Non-deterministic signer (e.g. MPC): fall back to a random seed encrypted with VEIL_PASSPHRASE.
      mode = "random";
      const passphrase = process.env.VEIL_PASSPHRASE;
      if (!passphrase) throw new Error("Wallet signing is non-deterministic. Set VEIL_PASSPHRASE to encrypt a random agent seed.");
      seed = new Uint8Array(randomBytes(32));
      const salt = randomBytes(16), iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", scryptSync(passphrase, salt, 32), iv);
      const ct = Buffer.concat([c.update(seed), c.final()]);
      writeAgentKey(wallet, chainId, { mode, salt: salt.toString("hex"), iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), ct: ct.toString("hex") });
      this.log("Using a random seed encrypted with VEIL_PASSPHRASE. Keep the passphrase safe.");
    }

    const veilAddress = formatAddress(await VeilKeys.fromSeed(seed));
    this.log(`\nSetup complete!\nAgent Veil address: ${veilAddress}`);
    return { status: "success", veilAddress, mode };
  }
}
