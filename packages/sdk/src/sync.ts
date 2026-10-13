import { readMemo } from "./memo.js";
import { commitmentOf, nullifierOf, Note } from "./note.js";
import { MerkleTree } from "./tree.js";
import { VeilKeys } from "./keys.js";

/** One NewCommitment event = one leaf of the pool's Merkle tree. */
export type Leaf = { index: number; commitment: bigint; memo: string; blockNumber?: number };

export type OwnedNote = Note & { commitment: bigint; privKey: bigint; nullifier: bigint; spent: boolean };

const ENVIO_QUERY = `
query leaves($pool: String!, $from: numeric!) {
  Commitment(where: { pool: { _eq: $pool }, index: { _gte: $from } }, order_by: { index: asc }, limit: 1000) {
    index commitment memo blockNumber
  }
}`;

function toLeaf(r: any): Leaf {
    return { index: Number(r.index), commitment: BigInt(r.commitment), memo: r.memo, blockNumber: r.blockNumber != null ? Number(r.blockNumber) : undefined };
}

/** Pull leaves from an Envio HyperIndex GraphQL endpoint, starting at leaf `from`. */
export async function fetchLeavesFromEnvio(envioUrl: string, pool: string, from = 0): Promise<Leaf[]> {
    const out: Leaf[] = [];
    let cursor = from;
    for (;;) {
        const res = await fetch(envioUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: ENVIO_QUERY, variables: { pool: pool.toLowerCase(), from: String(cursor) } }),
        });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        const rows = (json.data.Commitment as any[]).map(toLeaf);
        out.push(...rows);
        if (rows.length < 1000) break;
        cursor = rows[rows.length - 1].index + 1;
    }
    return out;
}

/** Pull leaves from the Veil relayer's RPC-backed cache (`GET /commitments`). */
export async function fetchLeavesFromRelayer(relayerUrl: string, pool: string, from = 0): Promise<{ leaves: Leaf[]; synced: boolean }> {
    const res = await fetch(`${relayerUrl.replace(/\/$/, "")}/commitments?pool=${pool}&from=${from}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `relayer /commitments failed (${res.status})`);
    return { leaves: (json.commitments as any[]).map(toLeaf), synced: !!json.synced };
}

/**
 * Leaves must form a gap-free sequence 0..n-1 or the tree root will be wrong.
 * Merges `incoming` into `known` and returns the contiguous prefix.
 */
export function mergeLeaves(known: Leaf[], incoming: Leaf[]): Leaf[] {
    const byIndex = new Map<number, Leaf>();
    for (const l of known) byIndex.set(l.index, l);
    for (const l of incoming) byIndex.set(l.index, l);
    const out: Leaf[] = [];
    for (let i = 0; byIndex.has(i); i++) out.push(byIndex.get(i)!);
    return out;
}

export async function treeFromLeaves(leaves: Leaf[]): Promise<MerkleTree> {
    const tree = new MerkleTree();
    for (const l of leaves) await tree.insert(l.commitment);
    return tree;
}

/**
 * Trial-decrypt every memo with our view key. A note only counts as ours if the
 * commitment recomputed from (amount, ourPubKey, blinding) equals the on-chain leaf,
 * so a forged memo can never show a fake balance.
 */
export async function scanLeaves(leaves: Leaf[], keys: VeilKeys): Promise<OwnedNote[]> {
    const notes: OwnedNote[] = [];
    for (const l of leaves) {
        if (!l.memo || l.memo === "0x") continue;
        const memo = l.memo.startsWith("0x") ? l.memo : `0x${l.memo}`;
        let opened;
        try { opened = readMemo(keys.encPriv, memo); } catch { opened = null; }
        if (!opened || opened.amount === 0n) continue;
        const note: Note = { amount: opened.amount, blinding: opened.blinding, pubKey: keys.pubKey, index: l.index };
        if ((await commitmentOf(note)) !== l.commitment) continue;
        const nullifier = await nullifierOf(note, keys.privKey);
        notes.push({ ...note, commitment: l.commitment, privKey: keys.privKey, nullifier, spent: false });
    }
    return notes;
}

const IS_SPENT_ABI = [{ type: "function", name: "isSpent", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] }] as const;

/** Ask the pool which of our notes are already spent (no nullifier indexing needed). */
export async function markSpent(publicClient: any, pool: string, notes: OwnedNote[]): Promise<OwnedNote[]> {
    const flags = await Promise.all(notes.map((n) =>
        n.spent ? true : publicClient.readContract({ address: pool, abi: IS_SPENT_ABI, functionName: "isSpent", args: [n.nullifier] })
    ));
    return notes.map((n, i) => ({ ...n, spent: Boolean(flags[i]) }));
}

/** Back-compat alias. */
export async function syncFromEnvio(url: string, pool: string, from = 0) {
    return fetchLeavesFromEnvio(url, pool, from);
}
