// src/constants.ts
var FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
var LEVELS = 20;
var MAX_NOTE_AMOUNT = 2n ** 128n;
var NETWORKS = {};

// src/poseidon.ts
import { buildPoseidon } from "circomlibjs";
var _p;
async function poseidon(inputs) {
  _p ??= await buildPoseidon();
  return _p.F.toObject(_p(inputs.map((x) => BigInt(x))));
}

// src/keys.ts
import { keccak256, concat, toBytes } from "viem";
import { x25519 } from "@noble/curves/ed25519";
import { HDKey } from "@scure/bip32";
var fieldMod = (x) => (x % FIELD_SIZE + FIELD_SIZE) % FIELD_SIZE;
var VeilKeys = class _VeilKeys {
  privKey;
  pubKey;
  encPriv;
  encPub;
  static async fromSeed(seed32) {
    const k = new _VeilKeys();
    k.privKey = fieldMod(BigInt(keccak256(concat([toBytes("veil-spend-v1"), seed32]))));
    k.pubKey = await poseidon([k.privKey]);
    k.encPriv = toBytes(keccak256(concat([toBytes("veil-enc-v1"), seed32])));
    k.encPub = x25519.getPublicKey(k.encPriv);
    return k;
  }
};
function deriveEvmKey(prfOutput, index) {
  const hdkey = HDKey.fromMasterSeed(prfOutput);
  const child = hdkey.derive(`m/44'/60'/0'/0/${index}`);
  return child.privateKey;
}
async function keysFromPrf(prfOutput) {
  return {
    publicAccountKey: deriveEvmKey(prfOutput, 0),
    main: await VeilKeys.fromSeed(deriveEvmKey(prfOutput, 1)),
    auditEnc: await VeilKeys.fromSeed(deriveEvmKey(prfOutput, 2)),
    atRestKey: deriveEvmKey(prfOutput, 3),
    agent: async (k) => VeilKeys.fromSeed(deriveEvmKey(prfOutput, 10 + k)),
    campaignAdmin: (j) => deriveEvmKey(prfOutput, 100 + j),
    campaignRefund: async (j) => VeilKeys.fromSeed(deriveEvmKey(prfOutput, 200 + j))
  };
}

// src/address.ts
import { toHex, toBytes as toBytes2 } from "viem";
function formatAddress(keys) {
  return `veil:${toHex(keys.pubKey, { size: 32 })}${toHex(keys.encPub).slice(2)}`;
}
function parseAddress(addr) {
  if (!addr.startsWith("veil:0x") || addr.length !== 7 + 128) throw new Error("bad veil address");
  const hex = addr.slice(7);
  const pubKey = BigInt("0x" + hex.slice(0, 64));
  if (pubKey >= FIELD_SIZE) throw new Error("pubKey out of field");
  return { pubKey, encPub: toBytes2("0x" + hex.slice(64)) };
}

// src/note.ts
async function commitmentOf(note) {
  return poseidon([note.amount, note.pubKey, note.blinding]);
}
async function nullifierOf(note, privKey) {
  const c = await commitmentOf(note);
  const sig = await poseidon([privKey, c, BigInt(note.index)]);
  return poseidon([c, BigInt(note.index), sig]);
}

// src/memo.ts
import { concat as concat2, toHex as toHex2, toBytes as toBytes3 } from "viem";
import { x25519 as x255192 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hkdf } from "@noble/hashes/hkdf";
var INFO = toBytes3("veil-note-v1");
function encryptNote(encPub, amount, blinding) {
  const eph = randomBytes(32);
  const shared = x255192.getSharedSecret(eph, encPub);
  const key = hkdf(sha256, shared, void 0, INFO, 32);
  const nonce = randomBytes(24);
  const pt = concat2([toBytes3(toHex2(amount, { size: 16 })), toBytes3(toHex2(blinding, { size: 32 }))]);
  const ct = xchacha20poly1305(key, nonce).encrypt(pt);
  return toHex2(concat2([x255192.getPublicKey(eph), nonce, ct]));
}
function decryptNote(encPriv, data) {
  try {
    const b = toBytes3(data);
    if (b.length !== 32 + 24 + 64) return null;
    const shared = x255192.getSharedSecret(encPriv, b.slice(0, 32));
    const key = hkdf(sha256, shared, void 0, INFO, 32);
    const pt = xchacha20poly1305(key, b.slice(32, 56)).decrypt(b.slice(56));
    return { amount: BigInt(toHex2(pt.slice(0, 16))), blinding: BigInt(toHex2(pt.slice(16, 48))) };
  } catch {
    return null;
  }
}
function readMemo(encPriv, data) {
  const b = toBytes3(data);
  if (b.length === 49 && b[0] === 1) {
    return { amount: BigInt(toHex2(b.slice(1, 17))), blinding: BigInt(toHex2(b.slice(17, 49))), plain: true };
  }
  return decryptNote(encPriv, data);
}

// src/tree.ts
var MerkleTree = class {
  leaves = [];
  zeros = null;
  layersCache = [];
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
    if (this.leaves.length === 0) return this.zeros[LEVELS];
    return this.layersCache[LEVELS][0] || this.zeros[LEVELS];
  }
  async path(index) {
    await this.init();
    const pathElements = [];
    let idx = index;
    for (let l = 0; l < LEVELS; l++) {
      const sib = idx ^ 1;
      pathElements.push(sib < this.layersCache[l].length ? this.layersCache[l][sib] : this.zeros[l]);
      idx >>= 1;
    }
    return { pathElements, pathIndices: index, root: this.layersCache[LEVELS][0] };
  }
  async insert(leaf) {
    await this.init();
    this.leaves.push(leaf);
    this.layersCache[0].push(leaf);
    let idx = this.leaves.length - 1;
    for (let l = 0; l < LEVELS; l++) {
      const sib = idx ^ 1;
      const left = sib > idx ? this.layersCache[l][idx] : sib < this.layersCache[l].length ? this.layersCache[l][sib] : this.zeros[l];
      const right = sib > idx ? sib < this.layersCache[l].length ? this.layersCache[l][sib] : this.zeros[l] : this.layersCache[l][idx];
      const p = await poseidon([left, right]);
      idx >>= 1;
      this.layersCache[l + 1][idx] = p;
    }
  }
};

// src/artifacts.ts
var WASM_SHA256 = "574079929F4A81DD1F4DD1E992E3AC602E0203D666189410E414B0A94BCD3166";
var ZKEY_SHA256 = "BD33470A44BA4FC2B563F0C6A4CBC6CECF3235CC3D41AD608283821E47C11181";
async function loadArtifacts(baseUrl) {
  const [wasmRes, zkeyRes] = await Promise.all([
    fetch(`${baseUrl}/transaction2x2.wasm`),
    fetch(`${baseUrl}/transaction2x2_final.zkey`)
  ]);
  const wasm = new Uint8Array(await wasmRes.arrayBuffer());
  const zkey = new Uint8Array(await zkeyRes.arrayBuffer());
  return { wasm, zkey };
}

// src/tx.ts
import { encodeAbiParameters, keccak256 as keccak2562, zeroAddress } from "viem";
import { randomBytes as randomBytes2 } from "@noble/hashes/utils";
import { toHex as toHex3 } from "viem";
function randomField() {
  return BigInt(toHex3(randomBytes2(31)));
}
var fieldMod2 = (x) => (x % FIELD_SIZE + FIELD_SIZE) % FIELD_SIZE;
function hashExtData(ext) {
  const abi = [{
    type: "tuple",
    components: [
      { name: "recipient", type: "address" },
      { name: "extAmount", type: "int256" },
      { name: "relayer", type: "address" },
      { name: "fee", type: "uint256" },
      { name: "encryptedOutput1", type: "bytes" },
      { name: "encryptedOutput2", type: "bytes" }
    ]
  }];
  return BigInt(keccak2562(encodeAbiParameters(abi, [ext]))) % FIELD_SIZE;
}
function publicAmountOf(extAmount, fee) {
  return fieldMod2(extAmount - fee);
}
async function buildTransaction({
  tree,
  inputs = [],
  outputs = [],
  extAmount = 0n,
  fee = 0n,
  recipient = zeroAddress,
  relayer = zeroAddress,
  changeKeys,
  prover
}) {
  if (inputs.length > 2 || outputs.length > 2) throw new Error("max 2 inputs and 2 outputs");
  const ins = [...inputs];
  while (ins.length < 2) {
    const privKey = randomField();
    ins.push({ amount: 0n, privKey, pubKey: await poseidon([privKey]), blinding: randomField(), index: 0 });
  }
  const outs = outputs.map((o) => ({ ...o, amount: o.amount || 0n, blinding: o.blinding ?? randomField() }));
  while (outs.length < 2) outs.push({ amount: 0n, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub, blinding: randomField() });
  for (const o of outs) if (o.amount < 0n || o.amount >= MAX_NOTE_AMOUNT) throw new Error("output amount out of range");
  const sumIn = ins.reduce((s, n) => s + n.amount, 0n);
  const sumOut = outs.reduce((s, n) => s + n.amount, 0n);
  if (sumIn + extAmount - fee !== sumOut) throw new Error(`unbalanced`);
  const root = await tree.root();
  const inPathElements = [];
  for (const n of ins) {
    if (n.amount === 0n) {
      inPathElements.push(new Array(LEVELS).fill(0n));
      continue;
    }
    const p = await tree.path(n.index);
    if (p.root !== root) throw new Error("path root mismatch");
    inPathElements.push(p.pathElements);
  }
  const extData = {
    recipient,
    extAmount,
    relayer,
    fee,
    encryptedOutput1: encryptNote(outs[0].encPub, outs[0].amount, outs[0].blinding),
    encryptedOutput2: encryptNote(outs[1].encPub, outs[1].amount, outs[1].blinding)
  };
  const extDataHash = hashExtData(extData);
  const publicAmount = publicAmountOf(extAmount, fee);
  const inputNullifier = await Promise.all(ins.map((n) => nullifierOf(n, n.privKey)));
  const outputCommitment = await Promise.all(outs.map((o) => commitmentOf(o)));
  const input = {
    root,
    publicAmount,
    extDataHash,
    inputNullifier,
    outputCommitment,
    inAmount: ins.map((n) => n.amount),
    inPrivateKey: ins.map((n) => n.privKey),
    inBlinding: ins.map((n) => n.blinding),
    inPathIndices: ins.map((n) => BigInt(n.index)),
    inPathElements,
    outAmount: outs.map((o) => o.amount),
    outPubkey: outs.map((o) => o.pubKey),
    outBlinding: outs.map((o) => o.blinding)
  };
  const { proofArgs, publicSignals } = await prover(input);
  return { proofArgs, extData, publicSignals, outputs: outs };
}
async function buildDeposit(amount, changeKeys, tree, prover) {
  return buildTransaction({ tree, extAmount: amount, outputs: [{ amount, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub }], changeKeys, prover });
}
async function buildTransfer(toAddr, amount, fee, relayer, inputs, changeKeys, tree, prover) {
  const to = parseAddress(toAddr);
  const change = inputs.reduce((a, b) => a + b.amount, 0n) - amount - fee;
  return buildTransaction({
    tree,
    inputs,
    outputs: [{ amount, pubKey: to.pubKey, encPub: to.encPub }],
    fee,
    relayer,
    changeKeys,
    prover
  });
}
async function buildWithdraw(recipient, amount, fee, relayer, inputs, changeKeys, tree, prover) {
  return buildTransaction({
    tree,
    inputs,
    extAmount: -amount,
    recipient,
    fee,
    relayer,
    changeKeys,
    prover
  });
}

// src/prover.ts
import * as snarkjs from "snarkjs";
var stringify = (v) => Array.isArray(v) ? v.map(stringify) : v.toString();
function createProver(wasm, zkey) {
  return async (input) => {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      Object.fromEntries(Object.entries(input).map(([k, v]) => [k, stringify(v)])),
      wasm,
      zkey
    );
    const proofArgs = {
      a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
      b: [[BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]],
      c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
      root: BigInt(publicSignals[0]),
      publicAmount: BigInt(publicSignals[1]),
      extDataHash: BigInt(publicSignals[2]),
      inputNullifiers: [BigInt(publicSignals[3]), BigInt(publicSignals[4])],
      outputCommitments: [BigInt(publicSignals[5]), BigInt(publicSignals[6])]
    };
    return { proofArgs, publicSignals };
  };
}

// src/coinSelect.ts
function selectInputs(notes, target) {
  const sorted = [...notes].sort((a, b) => a.amount < b.amount ? 1 : -1);
  const single = sorted.slice().reverse().find((n) => n.amount >= target);
  if (single) {
    return { inputs: [single], change: single.amount - target };
  }
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[i].amount + sorted[j].amount >= target) {
        return { inputs: [sorted[i], sorted[j]], change: sorted[i].amount + sorted[j].amount - target };
      }
    }
  }
  if (sorted.length >= 2) {
    return { inputs: [], change: 0n, needsMerge: [sorted[0], sorted[1]] };
  }
  throw new Error("insufficient balance");
}

// src/bigintJson.ts
function stringify2(obj) {
  return JSON.stringify(obj, (key, value) => typeof value === "bigint" ? value.toString() : value);
}
function parse(str) {
  return JSON.parse(str, (key, value) => {
    if (typeof value === "string" && /^-?\d+$/.test(value)) {
      try {
        return BigInt(value);
      } catch {
        return value;
      }
    }
    return value;
  });
}

// src/sync.ts
async function syncFromEnvio(url, lastBlock) {
  return [];
}
async function syncFromRpc(publicClient, contractAddress, lastBlock) {
  return [];
}

// src/store.ts
var MemoryNoteStore = class {
  notes = [];
  async addNote(note) {
    this.notes.push(note);
  }
  async removeNote(nullifier) {
  }
  async getNotes() {
    return this.notes;
  }
  async clear() {
    this.notes = [];
  }
};

// src/wallet.ts
var Wallet = class {
  constructor(keys, store) {
    this.keys = keys;
    this.store = store;
  }
  keys;
  store;
  async balance() {
    const notes = await this.store.getNotes();
    return notes.reduce((sum, n) => sum + n.amount, 0n);
  }
  async spendable() {
    return await this.store.getNotes();
  }
};

// src/submit.ts
async function submitDirect(walletClient, contractAddress, txArgs) {
}
async function submitViaRelayer(relayerUrl, txArgs) {
}

// src/disclose.ts
var disclose = {};

// src/x402.ts
var x402 = {};

// src/payroll.ts
var payroll = {};
export {
  FIELD_SIZE,
  LEVELS,
  MAX_NOTE_AMOUNT,
  MemoryNoteStore,
  MerkleTree,
  NETWORKS,
  VeilKeys,
  WASM_SHA256,
  Wallet,
  ZKEY_SHA256,
  buildDeposit,
  buildTransaction,
  buildTransfer,
  buildWithdraw,
  commitmentOf,
  createProver,
  decryptNote,
  deriveEvmKey,
  disclose,
  encryptNote,
  formatAddress,
  hashExtData,
  keysFromPrf,
  loadArtifacts,
  nullifierOf,
  parse,
  parseAddress,
  payroll,
  poseidon,
  publicAmountOf,
  readMemo,
  selectInputs,
  stringify2 as stringify,
  submitDirect,
  submitViaRelayer,
  syncFromEnvio,
  syncFromRpc,
  x402
};
