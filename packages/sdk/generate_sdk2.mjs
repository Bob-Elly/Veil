import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

const files = {
    'artifacts.ts': `
export const WASM_SHA256 = "574079929F4A81DD1F4DD1E992E3AC602E0203D666189410E414B0A94BCD3166";
export const ZKEY_SHA256 = "BD33470A44BA4FC2B563F0C6A4CBC6CECF3235CC3D41AD608283821E47C11181";

export async function loadArtifacts(baseUrl: string) {
    const [wasmRes, zkeyRes] = await Promise.all([
        fetch(\`\${baseUrl}/transaction2x2.wasm\`),
        fetch(\`\${baseUrl}/transaction2x2_final.zkey\`)
    ]);
    const wasm = new Uint8Array(await wasmRes.arrayBuffer());
    const zkey = new Uint8Array(await zkeyRes.arrayBuffer());
    return { wasm, zkey };
}
`,
    'tx.ts': `
import { encodeAbiParameters, keccak256, zeroAddress } from "viem";
import { poseidon } from "./poseidon.js";
import { encryptNote } from "./memo.js";
import { commitmentOf, nullifierOf, Note } from "./note.js";
import { MerkleTree } from "./tree.js";
import { FIELD_SIZE, LEVELS, MAX_NOTE_AMOUNT } from "./constants.js";
import { randomBytes } from "@noble/hashes/utils";
import { toHex } from "viem";
import { VeilKeys, parseAddress } from "./index.js";

function randomField() {
  return BigInt(toHex(randomBytes(31)));
}

const fieldMod = (x: bigint) => ((x % FIELD_SIZE) + FIELD_SIZE) % FIELD_SIZE;

export type ExtData = {
    recipient: string;
    extAmount: bigint;
    relayer: string;
    fee: bigint;
    encryptedOutput1: string;
    encryptedOutput2: string;
};

export function hashExtData(ext: ExtData) {
    const abi = [{
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
    return BigInt(keccak256(encodeAbiParameters(abi, [ext as any]))) % FIELD_SIZE;
}

export function publicAmountOf(extAmount: bigint, fee: bigint) {
    return fieldMod(extAmount - fee);
}

export async function buildTransaction({
    tree,
    inputs = [],
    outputs = [],
    extAmount = 0n,
    fee = 0n,
    recipient = zeroAddress,
    relayer = zeroAddress,
    changeKeys,
    prover
}: {
    tree: MerkleTree;
    inputs?: Note[];
    outputs?: Partial<Note>[];
    extAmount?: bigint;
    fee?: bigint;
    recipient?: string;
    relayer?: string;
    changeKeys: VeilKeys;
    prover: (input: any) => Promise<any>;
}) {
    if (inputs.length > 2 || outputs.length > 2) throw new Error("max 2 inputs and 2 outputs");
    const ins = [...inputs];
    while (ins.length < 2) {
        const privKey = randomField();
        ins.push({ amount: 0n, privKey, pubKey: await poseidon([privKey]), blinding: randomField(), index: 0 });
    }
    const outs = outputs.map((o) => ({ ...o, amount: o.amount || 0n, blinding: o.blinding ?? randomField() }));
    while (outs.length < 2) outs.push({ amount: 0n, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub, blinding: randomField() });

    for (const o of outs) if (o.amount! < 0n || o.amount! >= MAX_NOTE_AMOUNT) throw new Error("output amount out of range");
    const sumIn = ins.reduce((s, n) => s + n.amount, 0n);
    const sumOut = outs.reduce((s, n) => s + n.amount!, 0n);
    if (sumIn + extAmount - fee !== sumOut) throw new Error(\`unbalanced\`);

    const root = await tree.root();
    const inPathElements = [];
    for (const n of ins) {
        if (n.amount === 0n) { inPathElements.push(new Array(LEVELS).fill(0n)); continue; }
        const p = await tree.path(n.index);
        if (p.root !== root) throw new Error("path root mismatch");
        inPathElements.push(p.pathElements);
    }

    const extData: ExtData = {
        recipient, extAmount, relayer, fee,
        encryptedOutput1: encryptNote(outs[0].encPub!, outs[0].amount!, outs[0].blinding!),
        encryptedOutput2: encryptNote(outs[1].encPub!, outs[1].amount!, outs[1].blinding!),
    };
    const extDataHash = hashExtData(extData);
    const publicAmount = publicAmountOf(extAmount, fee);
    const inputNullifier = await Promise.all(ins.map((n) => nullifierOf(n as Note, n.privKey!)));
    const outputCommitment = await Promise.all(outs.map((o) => commitmentOf(o as Note)));

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

    const { proofArgs, publicSignals } = await prover(input);
    return { proofArgs, extData, publicSignals, outputs: outs };
}

export async function buildDeposit(amount: bigint, changeKeys: VeilKeys, tree: MerkleTree, prover: any) {
    return buildTransaction({ tree, extAmount: amount, outputs: [{ amount, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub }], changeKeys, prover });
}

export async function buildTransfer(toAddr: string, amount: bigint, fee: bigint, relayer: string, inputs: Note[], changeKeys: VeilKeys, tree: MerkleTree, prover: any) {
    const to = parseAddress(toAddr);
    const change = inputs.reduce((a, b) => a + b.amount, 0n) - amount - fee;
    return buildTransaction({
        tree, inputs, outputs: [{ amount, pubKey: to.pubKey, encPub: to.encPub }], fee, relayer, changeKeys, prover
    });
}

export async function buildWithdraw(recipient: string, amount: bigint, fee: bigint, relayer: string, inputs: Note[], changeKeys: VeilKeys, tree: MerkleTree, prover: any) {
    return buildTransaction({
        tree, inputs, extAmount: -amount, recipient, fee, relayer, changeKeys, prover
    });
}
`,
    'prover.ts': `
import * as snarkjs from "snarkjs";

const stringify = (v: any): any => (Array.isArray(v) ? v.map(stringify) : v.toString());

export function createProver(wasm: Uint8Array, zkey: Uint8Array) {
    return async (input: any) => {
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
            outputCommitments: [BigInt(publicSignals[5]), BigInt(publicSignals[6])],
        };
        return { proofArgs, publicSignals };
    };
}
`,
    'coinSelect.ts': `
import { Note } from "./note.js";

export function selectInputs(notes: Note[], target: bigint): { inputs: Note[]; change: bigint; needsMerge?: Note[] } {
    const sorted = [...notes].sort((a, b) => (a.amount < b.amount ? 1 : -1));
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
`,
    'bigintJson.ts': `
export function stringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value);
}

export function parse(str: string): any {
    return JSON.parse(str, (key, value) => {
        if (typeof value === 'string' && /^-?\\d+$/.test(value)) {
            try {
                return BigInt(value);
            } catch {
                return value;
            }
        }
        return value;
    });
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
export * from "./artifacts.js";
export * from "./tx.js";
export * from "./prover.js";
export * from "./coinSelect.js";
export * from "./bigintJson.js";
`
};

for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(srcDir, file), content.trim() + '\n');
}
console.log('Done writing files.');
