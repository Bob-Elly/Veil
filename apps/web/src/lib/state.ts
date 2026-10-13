import type { VeilPoolClient } from "@veil/sdk";
import type { VeilSession } from "./wallet";
import type { SyncedNote } from "./sync";
import type { AssetSymbol } from "./config";

export type AppState = {
    session: VeilSession | null;
    asset: AssetSymbol;
    setAsset: (a: AssetSymbol) => void;
    /** Notes of the selected asset's pool. */
    notes: SyncedNote[];
    balances: Record<AssetSymbol, bigint>;
    client: (a?: AssetSymbol) => VeilPoolClient | null;
    isSyncing: boolean;
    lastSync: Date | null;
    syncError: string | null;
    triggerSync: () => Promise<void>;
};
