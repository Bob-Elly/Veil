import { createDecipheriv, scryptSync } from "crypto";
import { keccak256, toBytes } from "viem";
import { VeilKeys } from "@veil/sdk";
import { readAgentKey } from "./state.js";

export const agentTypedData = (chainId: number, wallet: string) => ({
  domain: { name: "Veil", version: "1", chainId },
  types: { VeilAgentKey: [{ name: "purpose", type: "string" }, { name: "wallet", type: "address" }] },
  primaryType: "VeilAgentKey",
  message: { purpose: "Derive my Veil agent key. Only sign this in the Veil plugin.", wallet },
});

export function decryptSeed(state: { salt: string; iv: string; tag: string; ct: string }, passphrase: string) {
  const key = scryptSync(passphrase, Buffer.from(state.salt, "hex"), 32);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(state.iv, "hex"));
  d.setAuthTag(Buffer.from(state.tag, "hex"));
  return new Uint8Array(Buffer.concat([d.update(Buffer.from(state.ct, "hex")), d.final()]));
}

export async function getAgentKeys(ctx: any, chainId: number): Promise<VeilKeys> {
  const wallet = ctx.session.account;
  const state = readAgentKey(wallet, chainId);
  if (!state) throw new Error("Agent key not set up. Run 'mm veil setup' first.");
  if (state.mode === "derived") {
    // Deterministic wallet signature → seed. Nothing secret is stored on disk.
    const sig = await ctx.walletExecutor({ log: console.log }, "veil:derive", { kind: "typed-data", typedData: agentTypedData(chainId, wallet) });
    return VeilKeys.fromSeed(toBytes(keccak256(sig.signature as `0x${string}`)));
  }
  if (!process.env.VEIL_PASSPHRASE) throw new Error("VEIL_PASSPHRASE required to decrypt the agent key");
  return VeilKeys.fromSeed(decryptSeed(state, process.env.VEIL_PASSPHRASE));
}
