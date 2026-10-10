import { readMemo } from "@veil/sdk/dist/memo"; // Ensure proper import path or export in index.ts
import { nullifierOf } from "@veil/sdk/dist/note"; // Assuming these are exported, will verify
const ENVIO_URL = "http://localhost:8080/v1/graphql"; // Adjust this based on Envio deployment
export async function fetchCommitments(pool, lastIndex) {
    const query = `
    query getCommitments($pool: String!, $lastIndex: numeric!) {
      Commitment(
        where: { pool: { _eq: $pool }, index: { _gt: $lastIndex } }
        order_by: { index: asc }
        limit: 1000
      ) {
        index
        commitment
        memo
        blockNumber
      }
    }`;
    const res = await fetch(ENVIO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { pool, lastIndex: lastIndex.toString() } }),
    });
    const json = await res.json();
    if (json.errors)
        throw new Error(json.errors[0].message);
    return json.data.Commitment;
}
export async function fetchNullifiers(pool, lastBlock) {
    const query = `
    query getNullifiers($pool: String!, $lastBlock: numeric!) {
      Nullifier(
        where: { pool: { _eq: $pool }, blockNumber: { _gt: $lastBlock } }
        order_by: { blockNumber: asc }
        limit: 1000
      ) {
        nullifier
        blockNumber
      }
    }`;
    const res = await fetch(ENVIO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { pool, lastBlock: lastBlock.toString() } }),
    });
    const json = await res.json();
    if (json.errors)
        throw new Error(json.errors[0].message);
    return json.data.Nullifier;
}
export async function syncNotes(pool, keys, knownNotes, lastIndex, lastBlock, onProgress) {
    onProgress?.("Fetching new commitments...");
    let fetching = true;
    let currentIndex = lastIndex;
    const newNotes = [];
    while (fetching) {
        const comms = await fetchCommitments(pool, currentIndex);
        if (comms.length === 0)
            break;
        for (const c of comms) {
            try {
                // Remove '0x' prefix for SDK readMemo which expects hex string
                const memoHex = c.memo.startsWith("0x") ? c.memo.slice(2) : c.memo;
                const decrypted = readMemo(keys.encPriv, memoHex);
                if (decrypted) {
                    newNotes.push({
                        amount: decrypted.amount,
                        blinding: decrypted.blinding,
                        index: Number(c.index),
                        pubKey: keys.pubKey,
                        privKey: keys.privKey, // For spending
                        spent: false
                    });
                }
            }
            catch (e) {
                // Not for us
            }
            currentIndex = BigInt(c.index);
        }
        if (comms.length < 1000)
            fetching = false;
    }
    const allNotes = [...knownNotes, ...newNotes];
    onProgress?.("Fetching nullifiers...");
    fetching = true;
    let currentBlock = lastBlock;
    const nullifiers = new Set();
    while (fetching) {
        const nulls = await fetchNullifiers(pool, currentBlock);
        if (nulls.length === 0)
            break;
        for (const n of nulls) {
            nullifiers.add(BigInt(n.nullifier).toString());
            currentBlock = BigInt(n.blockNumber);
        }
        if (nulls.length < 1000)
            fetching = false;
    }
    // Mark as spent
    if (nullifiers.size > 0) {
        for (const note of allNotes) {
            if (!note.spent && note.privKey) {
                const nullifier = await nullifierOf(note, note.privKey);
                if (nullifiers.has(nullifier.toString())) {
                    note.spent = true;
                }
            }
        }
    }
    return {
        notes: allNotes,
        lastIndex: currentIndex,
        lastBlock: currentBlock
    };
}
