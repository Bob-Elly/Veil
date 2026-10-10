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
