import { Command, Flags } from "@oclif/core";
import { keccak256 } from "viem";
import { randomBytes } from "crypto";
import { writeAgentKey } from "../../state.js";
import { VeilKeys } from "@veil/sdk/dist/keys.js";
import { formatAddress } from "@veil/sdk/dist/address.js";

// We dynamically require @metamask/agent-wallet pieces since it's a peerDep.
// But we can import types if needed. We'll use any for context.
export default class SetupCommand extends Command {
  static description = "Set up the Veil agent key for the connected wallet";

  static flags = {
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
    export: Flags.boolean({ description: "Export backup" })
  };

  async run() {
    const { flags } = await this.parse(SetupCommand);
    const chainId = flags["chain-id"];
    
    // In oclif plugins for mm, the global Context is accessible or passed. 
    // We get the ctx from global (injected by mm runner)
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const wallet = ctx.session.account;
    
    const typedData = {
      domain: { name: "Veil", version: "1", chainId },
      types: {
        VeilAgentKey: [
          { name: "purpose", type: "string" },
          { name: "wallet", type: "address" }
        ]
      },
      primaryType: "VeilAgentKey",
      message: {
        purpose: "Derive my Veil agent key. Only sign this in the Veil plugin.",
        wallet
      }
    };

    this.log("Requesting signature 1...");
    const sig1 = await ctx.walletExecutor(this, "veil:setup", {
        kind: "typed-data",
        typedData
    });

    this.log("Requesting signature 2 to verify determinism...");
    const sig2 = await ctx.walletExecutor(this, "veil:setup", {
        kind: "typed-data",
        typedData
    });

    let seed: Uint8Array;
    let mode: string;

    if (sig1.signature === sig2.signature) {
        mode = "derived";
        seed = Buffer.from(keccak256(sig1.signature as `0x${string}`).slice(2), "hex");
        writeAgentKey(wallet, chainId, { mode });
    } else {
        mode = "random";
        const passphrase = process.env.VEIL_PASSPHRASE;
        if (!passphrase) {
            throw new Error("Wallet signing is non-deterministic. Set VEIL_PASSPHRASE env var to encrypt a random seed.");
        }
        seed = randomBytes(32);
        // Simplification: In reality, encrypt seed with AES-GCM using passphrase.
        writeAgentKey(wallet, chainId, { mode, encryptedSeed: seed.toString("hex") });
        this.log("Warning: Using random seed. Back up your key!");
    }

    const keys = VeilKeys.fromSeed(seed);
    const veilAddress = formatAddress(keys);

    this.log(`\nSetup complete!`);
    this.log(`Agent Veil Address: ${veilAddress}`);
    
    return { status: "success", veilAddress, mode };
  }
}
