"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { VeilKeys, VeilPoolClient } from "@veil/sdk";
import { useApp } from "@/components/Providers";
import { loginOrRegister } from "@/lib/wallet";
import { AssetSymbol, POOLS, txUrl } from "@/lib/config";
import { fmt, hexToBytes, poolClient, veilAddressOf } from "@/lib/veil";
import { getProver } from "@/lib/prover";
import { KindBadge } from "@/components/ui/SealedField";

const SYMBOLS = Object.keys(POOLS) as AssetSymbol[];

/**
 * /claim#<seed>: a payment to someone without a Veil account. The 32-byte seed in the URL
 * fragment (never sent to a server) is a one-time spending key holding the funds.
 */
export default function ClaimPage() {
  const { session, triggerSync } = useApp();
  const [clients, setClients] = useState<Partial<Record<AssetSymbol, VeilPoolClient>>>({});
  const [balances, setBalances] = useState<Partial<Record<AssetSymbol, bigint>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [address, setAddress] = useState("");

  const refresh = async (cs = clients) => {
    const out: Partial<Record<AssetSymbol, bigint>> = {};
    for (const s of SYMBOLS) {
      const c = cs[s];
      if (!c) continue;
      await c.sync();
      out[s] = c.balance;
    }
    setBalances(out);
  };

  useEffect(() => {
    (async () => {
      try {
        const seedHex = window.location.hash.replace(/^#/, "");
        if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) throw new Error("This claim link is incomplete. Ask the sender to share it again.");
        const keys = await VeilKeys.fromSeed(hexToBytes(seedHex));
        const cs: Partial<Record<AssetSymbol, VeilPoolClient>> = {};
        for (const s of SYMBOLS) cs[s] = poolClient(keys, s);
        setClients(cs);
        await refresh(cs);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async (to: "veil" | "public") => {
    setError(null);
    setTxHash(null);
    try {
      const prover = await getProver();
      for (const s of SYMBOLS) {
        const c = clients[s];
        const bal = balances[s] ?? 0n;
        if (!c || bal === 0n) continue;
        let hash: string;
        if (to === "veil") {
          if (!session) throw new Error("Sign in first");
          hash = await c.send(veilAddressOf(session.keys.main), bal, prover, (m) => setStatus(`${s}: ${m}`));
        } else {
          if (!isAddress(address.trim())) throw new Error("Enter a valid 0x address");
          hash = await c.withdraw(address.trim(), bal, prover, (m) => setStatus(`${s}: ${m}`));
        }
        setTxHash(hash);
      }
      await refresh();
      if (session) await triggerSync();
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message);
    } finally {
      setStatus(null);
    }
  };

  const total = SYMBOLS.reduce((a, s) => a + (balances[s] ?? 0n), 0n);

  return (
    <div className="max-w-xl mx-auto w-full space-y-6 py-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">Claim a private payment</h1>
          <KindBadge sealed={true} />
        </div>
        <p className="text-sm text-mute">Someone paid you through Veil. The amount and sender are not public. Claim it into your own Veil account or cash out to any wallet.</p>
      </div>

      <div className="gl-card p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-mute">Finding your payment…</p>
        ) : (
          <>
            <div className="space-y-1">
              {SYMBOLS.map((s) => (
                <div key={s} className="flex justify-between text-sm">
                  <span className="text-mute">{s}</span>
                  <span className="tnum text-foreground">{fmt(balances[s] ?? 0n)}</span>
                </div>
              ))}
            </div>
            {total === 0n && !error && <p className="text-xs text-mute">Nothing left to claim on this link (already claimed, or the payment is still confirming: refresh in a moment).</p>}

            {total > 0n && (
              <div className="space-y-4 pt-2 border-t border-line">
                {session ? (
                  <button className="btn btn-ink btn-block" disabled={!!status} onClick={() => claim("veil")}>Move into my Veil account</button>
                ) : (
                  <button className="btn btn-ink btn-block" onClick={() => loginOrRegister().catch((e) => setError(e.message))}>Sign in with passkey to claim privately</button>
                )}
                <div>
                  <label className="block text-xs font-medium text-mute mb-1.5">…or cash out to a public address</label>
                  <div className="flex gap-2">
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" className="gl-input font-mono text-xs flex-1" />
                    <button className="btn btn-ghost" disabled={!!status || !address} onClick={() => claim("public")}>Cash out</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {status && <div className="text-sealed text-xs p-3 bg-sealed-soft rounded-xl">{status}</div>}
        {error && <div className="text-danger text-xs p-3 bg-red-500/10 rounded-xl break-words">{error}</div>}
        {txHash && <a className="block text-xs underline text-mute font-mono truncate" href={txUrl(txHash)} target="_blank" rel="noreferrer">Claimed: {txHash}</a>}
      </div>
    </div>
  );
}
