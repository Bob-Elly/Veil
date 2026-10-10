import { VeilSession } from "./wallet";
import { SyncedNote } from "./sync";

export type AppState = {
    session: VeilSession | null;
    notes: SyncedNote[];
    isSyncing: boolean;
    lastSync: Date | null;
    triggerSync: () => void;
};
