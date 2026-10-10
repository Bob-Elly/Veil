"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { VeilSession, onSessionChange } from "@/lib/wallet";
import { SyncedNote, syncNotes } from "@/lib/sync";
import { AppState } from "@/lib/state";

const AppContext = createContext<AppState | null>(null);

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // USDC pool testnet

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<VeilSession | null>(null);
  const [notes, setNotes] = useState<SyncedNote[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const lastIndex = useRef(0n);
  const lastBlock = useRef(0n);

  const triggerSync = useCallback(async () => {
    if (!session || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncNotes(
        POOL_ADDRESS, 
        session.keys.main, 
        notes, 
        lastIndex.current, 
        lastBlock.current
      );
      setNotes(result.notes);
      lastIndex.current = result.lastIndex;
      lastBlock.current = result.lastBlock;
      setLastSync(new Date());
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [session, isSyncing, notes]);

  useEffect(() => {
    return onSessionChange(setSession);
  }, []);

  useEffect(() => {
    if (session) {
      triggerSync();
      const interval = setInterval(triggerSync, 10000);
      return () => clearInterval(interval);
    } else {
      setNotes([]);
      lastIndex.current = 0n;
      lastBlock.current = 0n;
      setLastSync(null);
    }
  }, [session]);

  return (
    <AppContext.Provider value={{ session, notes, isSyncing, lastSync, triggerSync }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext)!;
}
