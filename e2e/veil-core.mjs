// Veil reference core (Node 20+ / browser). Verified end-to-end against VeilPool on anvil.
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { encodeAbiParameters, keccak256, concat, toHex, toBytes, zeroAddress } from "viem";
import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hkdf } from "@noble/hashes/hkdf";

export const FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const LEVELS = 20;
export const MAX_NOTE_AMOUNT = 2n ** 128n;

// ── Poseidon (circomlibjs = same constants as circomlib and the on-chain hashers) ──
let _p;
export async function poseidon(inputs) {
  _p ??= await buildPoseidon();
  return _p.F.toObject(_p(inputs.map((x) => BigInt(x))));
}

/** 31 random bytes → always < FIELD_SIZE, no modulo bias. */
export function randomField() {
  return BigInt(toHex(randomBytes(31)));
}

const fieldMod = (x) => ((x % FIELD_SIZE) + FIELD_SIZE) % FIELD_SIZE;

// ── Keys ──
// spend key: owns notes. enc key: x25519, decrypts incoming notes (shareable as a view key).
export class VeilKeys {
  static async fromSeed(seed32 /* Uint8Array(32), e.g. a Mera-derived child private key */) {
    const k = new VeilKeys();
    k.privKey = fieldMod(BigInt(keccak256(concat([toBytes("veil-spend-v1"), seed32]))));
    k.pubKey = await poseidon([k.privKey]);
    k.encPriv = toBytes(keccak256(concat([toBytes("veil-enc-v1"), seed32])));
    k.encPub = x25519.getPublicKey(k.encPriv);
    return k;
  }
  static async random() {
    return VeilKeys.fromSeed(randomBytes(32));
  }
  /** Shareable address: veil:0x<pubKey 32 bytes><encPub 32 bytes> */
  address() {
    return `veil:${toHex(this.pubKey, { size: 32 })}${toHex(this.encPub).slice(2)}`;
  }
}

export function parseAddress(addr) {
  if (!addr.startsWith("veil:0x") || addr.length !== 7 + 128) throw new Error("bad veil address");
  const hex = addr.slice(7);
  const pubKey = BigInt("0x" + hex.slice(0, 64));
  if (pubKey >= FIELD_SIZE) throw new Error("pubKey out of field");
  return { pubKey, encPub: toBytes("0x" + hex.slice(64)) };
}

// ── Notes ──
export async function commitmentOf(note) {
  return poseidon([note.amount, note.pubKey, note.blinding]);
}
export async function nullifierOf(note, privKey) {
  const c = await commitmentOf(note);
  const sig = await poseidon([privKey, c, BigInt(note.index)]);
  return poseidon([c, BigInt(note.index), sig]);
}

// ── Note encryption: ephemeral x25519 → HKDF-SHA256 → XChaCha20-Poly1305 ──
// plaintext = amount (16 bytes BE) || blinding (32 bytes BE); output = eph(32) || nonce(24) || ct(64)
const INFO = toBytes("veil-note-v1");
export function encryptNote(encPub, amount, blinding) {
  const eph = randomBytes(32);
  const shared = x25519.getSharedSecret(eph, encPub);
  const key = hkdf(sha256, shared, undefined, INFO, 32);
  const nonce = randomBytes(24);
  const pt = concat([toBytes(toHex(amount, { size: 16 })), toBytes(toHex(blinding, { size: 32 }))]);
  const ct = xchacha20poly1305(key, nonce).encrypt(pt);
  return toHex(concat([x25519.getPublicKey(eph), nonce, ct]));
}
export function decryptNote(encPriv, data /* hex */) {
  try {
    const b = toBytes(data);
    if (b.length !== 32 + 24 + 64) return null;
    const shared = x25519.getSharedSecret(encPriv, b.slice(0, 32));
    const key = hkdf(sha256, shared, undefined, INFO, 32);
    const pt = xchacha20poly1305(key, b.slice(32, 56)).decrypt(b.slice(56));
    return { amount: BigInt(toHex(pt.slice(0, 16))), blinding: BigInt(toHex(pt.slice(16, 48))) };
  } catch {
    return null; // not for us (AEAD tag fails)
  }
}

// ── Merkle tree (matches MerkleTreeWithHistory.sol + merkleproof.circom) ──
export class MerkleTree {
  constructor() { this.leaves = []; this.zeros = null; }
  async init() {
    if (this.zeros) return;
    this.zeros = [0n];
    for (let i = 0; i < LEVELS; i++) this.zeros.push(await poseidon([this.zeros[i], this.zeros[i]]));
  }
  async layers() {
    await this.init();
    const layers = [this.leaves.slice()];
    for (let l = 0; l < LEVELS; l++) {
      const cur = layers[l], next = [];
      for (let i = 0; i < cur.length; i += 2) {
        next.push(await poseidon([cur[i], i + 1 < cur.length ? cur[i + 1] : this.zeros[l]]));
      }
      layers.push(next);
    }
    return layers;
  }
  async root() {
    await this.init();
    if (this.leaves.length === 0) return this.zeros[LEVELS];
    return (await this.layers())[LEVELS][0];
  }
  async path(index) {
    const layers = await this.layers();
    const pathElements = [];
    let idx = index;
    for (let l = 0; l < LEVELS; l++) {
      const sib = idx ^ 1;
      pathElements.push(sib < layers[l].length ? layers[l][sib] : this.zeros[l]);
      idx >>= 1;
    }
    return { pathElements, pathIndices: index, root: layers[LEVELS][0] };
  }
}

// ── ExtData + public amount (must match VeilPool.hashExtData / calculatePublicAmount) ──
const EXT_DATA_ABI = [{
  type: "tuple",
  components: [
    { name: "recipient", type: "address" },
    { name: "extAmount", type: "int256" },
    { name: "relayer", type: "address" },
    { name: "fee", type: "uint256" },
    { name: "encryptedOutput1", type: "bytes" },
    { name: "encryptedOutput2", type: "bytes" },
  ],
}];
export function hashExtData(ext) {
  return BigInt(keccak256(encodeAbiParameters(EXT_DATA_ABI, [ext]))) % FIELD_SIZE;
}
export function publicAmountOf(extAmount, fee) {
  return fieldMod(extAmount - fee);
}

/**
 * Build a 2-in/2-out transaction.
 * inputs:  up to 2 of { amount, pubKey, blinding, index, privKey }   (your own notes)
 * outputs: up to 2 of { amount, pubKey, encPub }                      (blinding is generated)
 * Rule: sum(inputs) + extAmount - fee == sum(outputs)
 */
export async function buildTransaction({ tree, inputs = [], outputs = [], extAmount = 0n, fee = 0n,
  recipient = zeroAddress, relayer = zeroAddress, changeKeys, wasm, zkey }) {
  if (inputs.length > 2 || outputs.length > 2) throw new Error("max 2 inputs and 2 outputs");
  const ins = [...inputs];
  while (ins.length < 2) {
    const privKey = randomField();
    ins.push({ amount: 0n, privKey, pubKey: await poseidon([privKey]), blinding: randomField(), index: 0 });
  }
  const outs = outputs.map((o) => ({ ...o, blinding: o.blinding ?? randomField() }));
  while (outs.length < 2) outs.push({ amount: 0n, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub, blinding: randomField() });

  for (const o of outs) if (o.amount < 0n || o.amount >= MAX_NOTE_AMOUNT) throw new Error("output amount out of range");
  const sumIn = ins.reduce((s, n) => s + n.amount, 0n);
  const sumOut = outs.reduce((s, n) => s + n.amount, 0n);
  if (sumIn + extAmount - fee !== sumOut) throw new Error(`unbalanced: in ${sumIn} + ext ${extAmount} - fee ${fee} != out ${sumOut}`);

  const root = await tree.root();
  const inPathElements = [];
  for (const n of ins) {
    if (n.amount === 0n) { inPathElements.push(new Array(LEVELS).fill(0n)); continue; }
    const p = await tree.path(n.index);
    if (p.root !== root) throw new Error("path root mismatch");
    inPathElements.push(p.pathElements);
  }

  const extData = {
    recipient, extAmount, relayer, fee,
    encryptedOutput1: encryptNote(outs[0].encPub, outs[0].amount, outs[0].blinding),
    encryptedOutput2: encryptNote(outs[1].encPub, outs[1].amount, outs[1].blinding),
  };
  const extDataHash = hashExtData(extData);
  const publicAmount = publicAmountOf(extAmount, fee);
  const inputNullifier = await Promise.all(ins.map((n) => nullifierOf(n, n.privKey)));
  const outputCommitment = await Promise.all(outs.map((o) => commitmentOf(o)));

  const input = {
    root, publicAmount, extDataHash, inputNullifier, outputCommitment,
    inAmount: ins.map((n) => n.amount),
    inPrivateKey: ins.map((n) => n.privKey),
    inBlinding: ins.map((n) => n.blinding),
    inPathIndices: ins.map((n) => BigInt(n.index)),
    inPathElements,
    outAmount: outs.map((o) => o.amount),
    outPubkey: outs.map((o) => o.pubKey),
    outBlinding: outs.map((o) => o.blinding),
  };
  const stringify = (v) => (Array.isArray(v) ? v.map(stringify) : v.toString());
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    Object.fromEntries(Object.entries(input).map(([k, v]) => [k, stringify(v)])), wasm, zkey);

  const proofArgs = {
    a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    // G2 coordinates are swapped for the Solidity verifier (same as Gloam packGroth16Proof)
    b: [[BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]],
    c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
    root, publicAmount, extDataHash,
    inputNullifiers: inputNullifier, outputCommitments: outputCommitment,
  };
  return { proofArgs, extData, publicSignals, outputs: outs };
}

/**
 * Read any memo from a NewCommitment event.
 *  - 120 bytes: encrypted note (encryptNote) → try our view key.
 *  - 49 bytes starting 0x01: "plain memo" from a contract (StreamVault) = 0x01 || amount(16) || blinding(32).
 * The caller MUST still check commitmentOf({amount, pubKey: ours, blinding}) == event commitment.
 */
export function readMemo(encPriv, data) {
  const b = toBytes(data);
  if (b.length === 49 && b[0] === 1) {
    return { amount: BigInt(toHex(b.slice(1, 17))), blinding: BigInt(toHex(b.slice(17, 49))), plain: true };
  }
  return decryptNote(encPriv, data);
}
