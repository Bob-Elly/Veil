"use client";

import { useState } from "react";
import { useApp } from "@/components/Providers";
import { parseUnits } from "viem";
import { buildTransfer, selectInputs, MerkleTree, VeilKeys } from "@veil/sdk";
import { getProver } from "@/lib/prover";
import { submitToRelayer } from "@/lib/relayer";
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

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1";
const RELAYER_ADDRESS = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";

export default function PayrollPage() {
  const { session, notes, triggerSync } = useApp();
  const [currency, setCurrency] = useState<"AUSD" | "USDC">("AUSD");
  const [rows, setRows] = useState<PayrollRow[]>([
    { id: "1", name: "Alice Dev", addressOrEmail: "veil:0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50", amount: "50", note: "October Engineering", status: "idle" },
    { id: "2", name: "Bob Design", addressOrEmail: "bob@remote-contractor.io", amount: "35", note: "Brand Assets", status: "idle" },
    { id: "3", name: "Carol Marketing", addressOrEmail: "carol@kol-agency.xyz", amount: "25", note: "Monad Metropolis KOL", status: "idle" }
  ]);
  const [isRunning, setIsRunning] = useState(false);
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
  const totalNotesBalance = notes.reduce((acc, n) => acc + (n.spent ? 0n : n.amount), 0n);
  const formattedBalance = Number(totalNotesBalance) / 1_000_000;

  const runSequentialPayroll = async () => {
    if (!session || isRunning) return;
    setIsRunning(true);

    try {
      const prover = await getProver();
      const tree = new MerkleTree();
      for (const n of notes) {
        if (n.commitment) await tree.insert(n.commitment);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.status === "sent") continue;

        setCurrentIdx(i);
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "preparing", error: undefined } : r));

        try {
          const amountAtomics = parseUnits(row.amount, 6);
          const available = notes.filter(n => !n.spent);
          const selection = selectInputs(available, amountAtomics);

          let targetVeilAddress = row.addressOrEmail;
          let generatedClaimLink: string | undefined = undefined;

          if (!row.addressOrEmail.startsWith("veil:0x")) {
            const seed = crypto.getRandomValues(new Uint8Array(32));
            const claimKeys = await VeilKeys.fromSeed(seed);
            targetVeilAddress = `veil:0x${claimKeys.pubKey.toString(16).padStart(64, "0")}${Buffer.from(claimKeys.encPub).toString("hex")}`;
            const seedHex = Buffer.from(seed).toString("hex");
            generatedClaimLink = `${window.location.origin}/claim#${seedHex}`;
          }

          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "proving" } : r));

          const { proofArgs, extData } = await buildTransfer(
            targetVeilAddress,
            amountAtomics,
            0n,
            RELAYER_ADDRESS,
            selection.inputs,
            session.keys.main,
            tree,
            prover
          );

          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "submitting" } : r));

          const res = await submitToRelayer(POOL_ADDRESS, proofArgs, extData);

          setRows(prev => prev.map((r, idx) => idx === i ? {
            ...r,
            status: "sent",
            txHash: res?.txHash || "relayed",
            claimLink: generatedClaimLink
          } : r));

          await triggerSync();
        } catch (err: any) {
          console.error(`Row ${i} failed:`, err);
          setRows(prev => prev.map((r, idx) => idx === i ? {
            ...r,
            status: "error",
            error: err.shortMessage || err.message || "Failed"
          } : r));
        }
      }
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
