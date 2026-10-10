import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

const files = {
    'sync.ts': `
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
`,
    'store.ts': `
import { Note } from "./note.js";

export interface NoteStore {
    addNote(note: Note): Promise<void>;
    removeNote(nullifier: bigint): Promise<void>;
    getNotes(): Promise<Note[]>;
    clear(): Promise<void>;
}

export class MemoryNoteStore implements NoteStore {
    private notes: Note[] = [];
    async addNote(note: Note) {
        this.notes.push(note);
    }
    async removeNote(nullifier: bigint) {
        // Find by nullifier logic requires knowing the private key or storing nullifiers alongside.
        // For simple memory store, we just keep it stubbed.
    }
    async getNotes() {
        return this.notes;
    }
    async clear() {
        this.notes = [];
    }
}
`,
    'wallet.ts': `
import { NoteStore } from "./store.js";
import { VeilKeys } from "./keys.js";
import { Note } from "./note.js";

export class Wallet {
    constructor(public keys: VeilKeys, public store: NoteStore) {}

    async balance(): Promise<bigint> {
        const notes = await this.store.getNotes();
        return notes.reduce((sum, n) => sum + n.amount, 0n);
    }

    async spendable(): Promise<Note[]> {
        return await this.store.getNotes();
    }
}
`,
    'submit.ts': `
export async function submitDirect(walletClient: any, contractAddress: string, txArgs: any) {
    // submit transaction directly to the RPC
}

export async function submitViaRelayer(relayerUrl: string, txArgs: any) {
    // submit transaction to relayer
}
`,
    'disclose.ts': `export const disclose = {};`,
    'x402.ts': `export const x402 = {};`,
    'payroll.ts': `export const payroll = {};`,
};

// Also update index.ts to export the new files
let indexContent = fs.readFileSync(path.join(srcDir, 'index.ts'), 'utf8');
const newExports = Object.keys(files).map(f => 'export * from "./' + f.replace('.ts', '.js') + '";').join('\\n');
indexContent += '\\n' + newExports + '\\n';
fs.writeFileSync(path.join(srcDir, 'index.ts'), indexContent);

for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(srcDir, file), content.trim() + '\\n');
}
console.log('Done writing remaining files.');
