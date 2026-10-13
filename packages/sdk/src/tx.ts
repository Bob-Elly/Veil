import { encodeAbiParameters, keccak256, zeroAddress } from "viem";
import { poseidon } from "./poseidon.js";
import { encryptNote } from "./memo.js";
import { commitmentOf, nullifierOf, Note } from "./note.js";
import { MerkleTree } from "./tree.js";
import { FIELD_SIZE, LEVELS, MAX_NOTE_AMOUNT } from "./constants.js";
import { randomBytes } from "@noble/hashes/utils";
import { toHex } from "viem";
import { VeilKeys } from "./keys.js";
import { parseAddress } from "./address.js";

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
    if (sumIn + extAmount - fee !== sumOut) throw new Error(`unbalanced`);

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
    if (change < 0n) throw new Error("insufficient inputs");
    return buildTransaction({
        tree, inputs, fee, relayer, changeKeys, prover,
        outputs: [{ amount, pubKey: to.pubKey, encPub: to.encPub }, { amount: change, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub }],
    });
}

export async function buildWithdraw(recipient: string, amount: bigint, fee: bigint, relayer: string, inputs: Note[], changeKeys: VeilKeys, tree: MerkleTree, prover: any) {
    const change = inputs.reduce((a, b) => a + b.amount, 0n) - amount - fee;
    if (change < 0n) throw new Error("insufficient inputs");
    return buildTransaction({
        tree, inputs, extAmount: -amount, recipient, fee, relayer, changeKeys, prover,
        outputs: [{ amount: change, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub }],
    });
}

/** Combine two notes into one (self-transfer). Needed when no 1 or 2 notes cover a payment. */
export async function buildMerge(inputs: Note[], fee: bigint, relayer: string, changeKeys: VeilKeys, tree: MerkleTree, prover: any) {
    const total = inputs.reduce((a, b) => a + b.amount, 0n) - fee;
    return buildTransaction({
        tree, inputs, fee, relayer, changeKeys, prover,
        outputs: [{ amount: total, pubKey: changeKeys.pubKey, encPub: changeKeys.encPub }],
    });
}
