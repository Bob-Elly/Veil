import { concat, toHex, toBytes } from "viem";
import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hkdf } from "@noble/hashes/hkdf";

const INFO = toBytes("veil-note-v1");

export function encryptNote(encPub: Uint8Array, amount: bigint, blinding: bigint): string {
  const eph = randomBytes(32);
  const shared = x25519.getSharedSecret(eph, encPub);
  const key = hkdf(sha256, shared, undefined, INFO, 32);
  const nonce = randomBytes(24);
  const pt = concat([toBytes(toHex(amount, { size: 16 })), toBytes(toHex(blinding, { size: 32 }))]);
  const ct = xchacha20poly1305(key, nonce).encrypt(pt);
  return toHex(concat([x25519.getPublicKey(eph), nonce, ct]));
}

export function decryptNote(encPriv: Uint8Array, data: string) {
  try {
    const b = toBytes(data as `0x${string}`);
    if (b.length !== 32 + 24 + 64) return null;
    const shared = x25519.getSharedSecret(encPriv, b.slice(0, 32));
    const key = hkdf(sha256, shared, undefined, INFO, 32);
    const pt = xchacha20poly1305(key, b.slice(32, 56)).decrypt(b.slice(56));
    return { amount: BigInt(toHex(pt.slice(0, 16))), blinding: BigInt(toHex(pt.slice(16, 48))) };
  } catch {
    return null;
  }
}

export function readMemo(encPriv: Uint8Array, data: string) {
  const b = toBytes(data as `0x${string}`);
  if (b.length === 49 && b[0] === 1) {
    return { amount: BigInt(toHex(b.slice(1, 17))), blinding: BigInt(toHex(b.slice(17, 49))), plain: true };
  }
  return decryptNote(encPriv, data);
}
