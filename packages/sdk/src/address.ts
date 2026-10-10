import { toHex, toBytes } from "viem";
import { FIELD_SIZE } from "./constants.js";
import { VeilKeys } from "./keys.js";

export function formatAddress(keys: VeilKeys): string {
  return `veil:${toHex(keys.pubKey, { size: 32 })}${toHex(keys.encPub).slice(2)}`;
}

export function parseAddress(addr: string) {
  if (!addr.startsWith("veil:0x") || addr.length !== 7 + 128) throw new Error("bad veil address");
  const hex = addr.slice(7);
  const pubKey = BigInt("0x" + hex.slice(0, 64));
  if (pubKey >= FIELD_SIZE) throw new Error("pubKey out of field");
  return { pubKey, encPub: toBytes("0x" + hex.slice(64)) };
}
