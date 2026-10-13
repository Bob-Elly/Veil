import type { OwnedNote } from "@veil/sdk";

// Notes are synced by VeilPoolClient (@veil/sdk): Envio when NEXT_PUBLIC_ENVIO_URL is set,
// otherwise the relayer's RPC-backed commitment cache.
export type SyncedNote = OwnedNote;
