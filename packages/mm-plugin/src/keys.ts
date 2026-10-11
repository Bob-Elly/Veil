import { readAgentKey } from "./state.js";
import { keccak256 } from "viem";
import { VeilKeys } from "@veil/sdk/dist/keys.js";

export async function getAgentKeys(ctx: any, chainId: number): Promise<VeilKeys> {
    const wallet = ctx.session.account;
    const state = readAgentKey(wallet, chainId);
    if (!state) throw new Error("Agent key not set up. Run 'mm veil setup' first.");

    if (state.mode === "derived") {
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

        // For non-interactive flows in mm, walletExecutor with typed-data might prompt.
        // Usually, in a plugin context, we should cache this during the session, but mm might handle it.
        // In this implementation we will ask for the signature again to derive.
        const sig = await ctx.walletExecutor({ log: console.log }, "veil:derive", {
            kind: "typed-data",
            typedData
        });
        
        const seed = Buffer.from(keccak256(sig.signature as `0x${string}`).slice(2), "hex");
        return VeilKeys.fromSeed(seed);
    } else {
        if (!process.env.VEIL_PASSPHRASE) throw new Error("VEIL_PASSPHRASE required to decrypt key");
        // Simplified for demo:
        return VeilKeys.fromSeed(Buffer.from(state.encryptedSeed, "hex"));
    }
}
