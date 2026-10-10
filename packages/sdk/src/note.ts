import { poseidon } from "./poseidon.js";

export type Note = { amount: bigint; pubKey: bigint; blinding: bigint; index: number; privKey?: bigint; encPub?: Uint8Array };

export async function commitmentOf(note: Note): Promise<bigint> {
  return poseidon([note.amount, note.pubKey, note.blinding]);
}

export async function nullifierOf(note: Note, privKey: bigint): Promise<bigint> {
  const c = await commitmentOf(note);
  const sig = await poseidon([privKey, c, BigInt(note.index)]);
  return poseidon([c, BigInt(note.index), sig]);
}
