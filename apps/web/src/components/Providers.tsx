"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { VeilPoolClient } from "@veil/sdk";
import { VeilSession, onSessionChange } from "@/lib/wallet";
import { SyncedNote } from "@/lib/sync";
import { AppState } from "@/lib/state";
import { AssetSymbol, POOLS } from "@/lib/config";
import { poolClient } from "@/lib/veil";

const AppContext = createContext<AppState | null>(null);
const SYMBOLS = Object.keys(POOLS) as AssetSymbol[];
const EMPTY: Record<AssetSymbol, bigint> = { USDC: 0n, AUSD: 0n };

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<VeilSession | null>(null);
  const [asset, setAsset] = useState<AssetSymbol>("USDC");
  const [notesBy, setNotesBy] = useState<Record<AssetSymbol, SyncedNote[]>>({ USDC: [], AUSD: [] });
  const [balances, setBalances] = useState<Record<AssetSymbol, bigint>>(EMPTY);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // One VeilPoolClient per pool, rebuilt when the passkey session changes.
  const clients = useRef<Partial<Record<AssetSymbol, VeilPoolClient>>>({});
  const syncing = useRef(false);

  const triggerSync = useCallback(async () => {
    if (!session || syncing.current) return;
    syncing.current = true;
    setIsSyncing(true);
    try {
      const errors: string[] = [];
      await Promise.all(SYMBOLS.map(async (s) => {
        const c = clients.current[s];
        if (!c) return;
        try { await c.sync(); } catch (e: any) { errors.push(`${s}: ${e.message}`); }
      }));
      const nb = { USDC: [], AUSD: [] } as Record<AssetSymbol, SyncedNote[]>;
      const bal = { ...EMPTY };
      for (const s of SYMBOLS) {
        const c = clients.current[s];
        if (!c) continue;
        nb[s] = [...c.notes];
        bal[s] = c.balance;
      }
      setNotesBy(nb);
      setBalances(bal);
      setSyncError(errors.length ? errors.join(" · ") : null);
      setLastSync(new Date());
    } finally {
      syncing.current = false;
      setIsSyncing(false);
    }
  }, [session]);

  useEffect(() => onSessionChange(setSession), []);

  useEffect(() => {
    if (!session) {
      clients.current = {};
      setNotesBy({ USDC: [], AUSD: [] });
      setBalances(EMPTY);
      setLastSync(null);
      return;
    }
    for (const s of SYMBOLS) clients.current[s] = poolClient(session.keys.main, s);
    triggerSync();
    const interval = setInterval(triggerSync, 10000);
    return () => clearInterval(interval);
  }, [session, triggerSync]);

  const client = useCallback((a?: AssetSymbol) => clients.current[a ?? asset] ?? null, [asset]);

  return (
    <AppContext.Provider value={{ session, asset, setAsset, notes: notesBy[asset], balances, client, isSyncing, lastSync, syncError, triggerSync }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext)!;
}
