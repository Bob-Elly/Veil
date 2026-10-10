import { keccak256, concat, toBytes } from "viem";
import { poseidon } from "./poseidon.js";
import { x25519 } from "@noble/curves/ed25519";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { FIELD_SIZE } from "./constants.js";

const fieldMod = (x: bigint) => ((x % FIELD_SIZE) + FIELD_SIZE) % FIELD_SIZE;

export class VeilKeys {
  privKey!: bigint;
  pubKey!: bigint;
  encPriv!: Uint8Array;
  encPub!: Uint8Array;

  static async fromSeed(seed32: Uint8Array): Promise<VeilKeys> {
    const k = new VeilKeys();
    k.privKey = fieldMod(BigInt(keccak256(concat([toBytes("veil-spend-v1"), seed32]))));
    k.pubKey = await poseidon([k.privKey]);
    k.encPriv = toBytes(keccak256(concat([toBytes("veil-enc-v1"), seed32])));
    k.encPub = x25519.getPublicKey(k.encPriv);
    return k;
  }
}

export function deriveEvmKey(prfOutput: Uint8Array, index: number): Uint8Array {
    const hdkey = HDKey.fromMasterSeed(prfOutput);
    const child = hdkey.derive(`m/44'/60'/0'/0/${index}`);
    return child.privateKey!;
}

export async function keysFromPrf(prfOutput: Uint8Array) {
    return {
        publicAccountKey: deriveEvmKey(prfOutput, 0),
        main: await VeilKeys.fromSeed(deriveEvmKey(prfOutput, 1)),
        auditEnc: await VeilKeys.fromSeed(deriveEvmKey(prfOutput, 2)),
        atRestKey: deriveEvmKey(prfOutput, 3),
        agent: async (k: number) => VeilKeys.fromSeed(deriveEvmKey(prfOutput, 10 + k)),
        campaignAdmin: (j: number) => deriveEvmKey(prfOutput, 100 + j),
        campaignRefund: async (j: number) => VeilKeys.fromSeed(deriveEvmKey(prfOutput, 200 + j))
    };
}
