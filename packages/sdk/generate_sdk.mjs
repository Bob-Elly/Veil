import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

const files = {
    'poseidon.ts': `
import { buildPoseidon } from "circomlibjs";

let _p: any;
export async function poseidon(inputs: bigint[]): Promise<bigint> {
  _p ??= await buildPoseidon();
  return _p.F.toObject(_p(inputs.map((x) => BigInt(x))));
}
`,
    'keys.ts': `
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
    const child = hdkey.derive(\`m/44'/60'/0'/0/\${index}\`);
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
`,
    'address.ts': `
import { toHex, toBytes } from "viem";
import { FIELD_SIZE } from "./constants.js";
import { VeilKeys } from "./keys.js";

export function formatAddress(keys: VeilKeys): string {
  return \`veil:\${toHex(keys.pubKey, { size: 32 })}\${toHex(keys.encPub).slice(2)}\`;
}

export function parseAddress(addr: string) {
  if (!addr.startsWith("veil:0x") || addr.length !== 7 + 128) throw new Error("bad veil address");
  const hex = addr.slice(7);
  const pubKey = BigInt("0x" + hex.slice(0, 64));
  if (pubKey >= FIELD_SIZE) throw new Error("pubKey out of field");
  return { pubKey, encPub: toBytes("0x" + hex.slice(64)) };
}
`,
    'note.ts': `
import { poseidon } from "./poseidon.js";

export type Note = { amount: bigint; pubKey: bigint; blinding: bigint; index: number; privKey?: bigint; encPub?: Uint8Array };

export async function commitmentOf(note: Note): Promise<bigint> {
  return poseidon([note.amount, note.pubKey, note.blinding]);
}

export async function nullifierOf(note: Note, privKey: bigint): Promise<bigint> {
  const c = await commitmentOf(note);
  const sig = await poseidon([privKey, c, BigInt(note.index)]);
  return poseidon([c, BigInt(note.index), sig]);
}
`,
    'memo.ts': `
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
    const b = toBytes(data as \`0x\${string}\`);
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
  const b = toBytes(data as \`0x\${string}\`);
  if (b.length === 49 && b[0] === 1) {
    return { amount: BigInt(toHex(b.slice(1, 17))), blinding: BigInt(toHex(b.slice(17, 49))), plain: true };
  }
  return decryptNote(encPriv, data);
}
`,
    'tree.ts': `
import { poseidon } from "./poseidon.js";
import { LEVELS } from "./constants.js";

export class MerkleTree {
  leaves: bigint[] = [];
  zeros: bigint[] | null = null;
  layersCache: bigint[][] = [];

  async init() {
    if (this.zeros) return;
    this.zeros = [0n];
    for (let i = 0; i < LEVELS; i++) this.zeros.push(await poseidon([this.zeros[i], this.zeros[i]]));
    this.layersCache = [this.leaves.slice()];
    for (let l = 0; l < LEVELS; l++) {
      const cur = this.layersCache[l], next = [];
      for (let i = 0; i < cur.length; i += 2) {
        next.push(await poseidon([cur[i], i + 1 < cur.length ? cur[i + 1] : this.zeros[l]]));
      }
      this.layersCache.push(next);
    }
  }
  async root() {
    await this.init();
    if (this.leaves.length === 0) return this.zeros![LEVELS];
    return this.layersCache[LEVELS][0] || this.zeros![LEVELS];
  }
  async path(index: number) {
    await this.init();
    const pathElements = [];
    let idx = index;
    for (let l = 0; l < LEVELS; l++) {
      const sib = idx ^ 1;
      pathElements.push(sib < this.layersCache[l].length ? this.layersCache[l][sib] : this.zeros![l]);
      idx >>= 1;
    }
    return { pathElements, pathIndices: index, root: this.layersCache[LEVELS][0] };
  }
  async insert(leaf: bigint) {
    await this.init();
    this.leaves.push(leaf);
    this.layersCache[0].push(leaf);
    let idx = this.leaves.length - 1;
    for (let l = 0; l < LEVELS; l++) {
        const sib = idx ^ 1;
        const left = sib > idx ? this.layersCache[l][idx] : (sib < this.layersCache[l].length ? this.layersCache[l][sib] : this.zeros![l]);
        const right = sib > idx ? (sib < this.layersCache[l].length ? this.layersCache[l][sib] : this.zeros![l]) : this.layersCache[l][idx];
        const p = await poseidon([left, right]);
        idx >>= 1;
        this.layersCache[l+1][idx] = p;
    }
  }
}
`,
    'index.ts': `
export * from "./constants.js";
export * from "./poseidon.js";
export * from "./keys.js";
export * from "./address.js";
export * from "./note.js";
export * from "./memo.js";
export * from "./tree.js";
`
};

for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(srcDir, file), content.trim() + '\n');
}
console.log('Done writing files.');
