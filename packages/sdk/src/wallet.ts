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
