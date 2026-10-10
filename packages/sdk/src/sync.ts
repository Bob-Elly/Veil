import { Note } from "./note.js";
import { readMemo } from "./memo.js";
import { parseAddress, VeilKeys } from "./index.js";

// Placeholder for sync logic
export async function syncFromEnvio(url: string, lastBlock: number) {
    return [];
}

export async function syncFromRpc(publicClient: any, contractAddress: string, lastBlock: number) {
    return [];
}
