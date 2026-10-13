"use client";

import { useState } from "react";
import { useApp } from "@/components/Providers";
import { parseUnits } from "viem";
import { useEffect } from "react";
import { getProver } from "@/lib/prover";
import { createClaimTarget } from "@/lib/veil";
import { KindBadge, SealDots } from "@/components/ui/SealedField";

type PayrollRow = {
  id: string;
  name: string;
  addressOrEmail: string;
  amount: string;
  note: string;
  status: "idle" | "preparing" | "proving" | "submitting" | "sent" | "error";
  txHash?: string;
  claimLink?: string;
  error?: string;
};

const STORE_KEY = "veil.payroll.v1";

export default function PayrollPage() {
  const { session, triggerSync, client, balances } = useApp();
  const [currency, setCurrency] = useState<"AUSD" | "USDC">("AUSD");
  const [rows, setRows] = useState<PayrollRow[]>([
    { id: "1", name: "Alice Dev", addressOrEmail: "alice@studio.dev", amount: "5", note: "October Engineering", status: "idle" },
    { id: "2", name: "Bob Design", addressOrEmail: "bob@remote-contractor.io", amount: "3", note: "Brand Assets", status: "idle" },
    { id: "3", name: "Carol Marketing", addressOrEmail: "carol@kol-agency.xyz", amount: "2", note: "Monad Metropolis KOL", status: "idle" }
  ]);
  const [isRunning, setIsRunning] = useState(false);

  // Crash-safe: the run (statuses, tx hashes, claim links) is kept in this browser and resumes after a reload.
  useEffect(() => {
    try { const saved = localStorage.getItem(STORE_KEY); if (saved) setRows(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rows.map(r => (r.status === "idle" || r.status === "sent" || r.status === "error") ? r : { ...r, status: "idle" }))); } catch {}
  }, [rows]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim().length > 0);
      const parsed: PayrollRow[] = [];
      const startIdx = lines[0].toLowerCase().includes("name") ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim());
        if (parts.length >= 3) {
          parsed.push({
            id: `row-${i}`,
            name: parts[0] || `Recipient ${i}`,
            addressOrEmail: parts[1],
            amount: parts[2],
            note: parts[3] || "Payroll",
            status: "idle"
          });
        }
      }
      if (parsed.length > 0) setRows(parsed);
    };
    reader.readAsText(file);
  };

  const totalAmount = rows.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
  const totalNotesBalance = balances[currency];
  const formattedBalance = Number(totalNotesBalance) / 1_000_000;

  const runSequentialPayroll = async () => {
    const c = client(currency);
    if (!session || isRunning || !c) return;
    setIsRunning(true);
    try {
      const prover = await getProver();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.status === "sent") continue; // resume: rows already paid are skipped

        setCurrentIdx(i);
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "preparing", error: undefined } : r));
        try {
          const amountAtomics = parseUnits(row.amount, 6);
          let target = row.addressOrEmail.trim();
          let claimLink: string | undefined;
          if (!target.startsWith("veil:")) {
            const claim = await createClaimTarget();
            target = claim.address;
            claimLink = claim.link;
          }
          // Save the claim link before paying, so a crash mid-payment never loses it.
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "proving", claimLink } : r));
          const txHash = await c.send(target, amountAtomics, prover, (m) => {
            if (m.startsWith("Relaying")) setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "submitting" } : r));
          });
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "sent", txHash, claimLink } : r));
        } catch (err: any) {
          console.error(`Row ${i} failed:`, err);
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err.shortMessage || err.message || "Failed" } : r));
        }
      }
      await triggerSync();
    } finally {
      setIsRunning(false);
      setCurrentIdx(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
              Payroll
            </h1>
            <KindBadge sealed={true} />
          </div>
          <p className="text-sm text-mute max-w-xl">
            Disburse cross-border payouts in Agora AUSD or USDC without publishing your salary ledger. Un-onboarded recipients get a zero-knowledge claim link.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="btn btn-ghost btn-sm cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={runSequentialPayroll}
            disabled={!session || isRunning || totalAmount === 0}
            className="btn btn-ink btn-sm"
          >
            {isRunning ? `Running #${(currentIdx ?? 0) + 1}…` : `Execute Payroll ($${totalAmount} ${currency})`}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Batch Total</span>
          <span className="tnum text-2xl font-light text-foreground">${totalAmount.toFixed(2)} {currency}</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Shielded Balance</span>
          <span className="tnum text-2xl font-light text-foreground">${formattedBalance.toFixed(2)}</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Currency</span>
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => setCurrency("AUSD")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                currency === "AUSD" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
              }`}
            >
              Agora AUSD
            </button>
            <button
              onClick={() => setCurrency("USDC")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                currency === "USDC" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
              }`}
            >
              USDC
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="gl-card overflow-hidden">
        <div className="px-6 py-3 border-b border-line flex justify-between items-center text-xs text-mute">
          <span>{rows.length} recipients in queue</span>
          <span>Crash-safe sequential execution</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-mute">
              <tr>
                <th className="px-6 py-3 font-medium">Recipient</th>
                <th className="px-6 py-3 font-medium">Destination</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Memo</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Claim link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{row.name}</td>
                  <td className="px-6 py-4 font-mono text-mute max-w-[200px] truncate">
                    {row.addressOrEmail}
                  </td>
                  <td className="px-6 py-4 font-medium tnum text-foreground">${row.amount}</td>
                  <td className="px-6 py-4 text-mute">{row.note}</td>
                  <td className="px-6 py-4">
                    {row.status === "idle" && <span className="text-mute">Ready</span>}
                    {row.status === "preparing" && <span className="text-mute">Preparing…</span>}
                    {row.status === "proving" && <span className="text-foreground font-medium">Proving ZK…</span>}
                    {row.status === "submitting" && <span className="text-mute">Relaying…</span>}
                    {row.status === "sent" && <span className="text-sealed font-medium">Sent</span>}
                    {row.status === "error" && <span className="text-danger font-medium">{row.error}</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.claimLink ? (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(row.claimLink!);
                          alert("Claim link copied!");
                        }}
                        className="text-foreground hover:underline font-medium"
                      >
                        Copy link
                      </button>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
