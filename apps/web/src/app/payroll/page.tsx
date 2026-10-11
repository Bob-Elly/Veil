"use client";

import { useState } from "react";
import { useApp } from "@/components/Providers";
import { parseUnits } from "viem";
import { buildTransfer, selectInputs, MerkleTree, VeilKeys } from "@veil/sdk";
import { getProver } from "@/lib/prover";
import { submitToRelayer } from "@/lib/relayer";
import { 
  DocumentArrowUpIcon, 
  PlayIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ArrowPathIcon,
  ShareIcon
} from "@heroicons/react/24/outline";

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

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // USDC pool
const RELAYER_ADDRESS = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";

export default function PayrollPage() {
  const { session, notes, triggerSync } = useApp();
  const [currency, setCurrency] = useState<"USDC" | "AUSD">("AUSD");
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
      // Support CSV: name,veil_address_or_email,amount,note
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

          // If row address is not a veil address, generate a Claim Link
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

          // Trigger optimistic sync for change note
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
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold tracking-wide uppercase">
              Agora & Monad Metropolis: Confidential Payroll
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Private CSV Payroll</h1>
          <p className="text-neutral-400 mt-1 max-w-2xl">
            Disburse cross-border contractor payouts and team salaries with complete financial privacy. Recipients without a Veil address automatically receive zero-knowledge claim links.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all">
            <DocumentArrowUpIcon className="w-4 h-4 text-neutral-400" />
            Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={runSequentialPayroll}
            disabled={!session || isRunning || totalAmount === 0}
            className="px-6 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
          >
            {isRunning ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Processing Row {(currentIdx ?? 0) + 1}...
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                Run Payroll (${totalAmount} {currency})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <span className="text-xs text-neutral-400 block mb-1">Batch Total</span>
          <span className="text-2xl font-black text-white">${totalAmount.toFixed(2)} {currency}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <span className="text-xs text-neutral-400 block mb-1">Shielded Balance</span>
          <span className="text-2xl font-black text-indigo-300">${formattedBalance.toFixed(2)}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <span className="text-xs text-neutral-400 block mb-1">Default Stablecoin</span>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setCurrency("AUSD")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold ${currency === "AUSD" ? "bg-purple-600 text-white" : "bg-white/5 text-neutral-400"}`}
            >
              Agora AUSD
            </button>
            <button
              onClick={() => setCurrency("USDC")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold ${currency === "USDC" ? "bg-indigo-600 text-white" : "bg-white/5 text-neutral-400"}`}
            >
              USDC
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center text-xs text-neutral-400 font-medium">
          <span>{rows.length} Recipients in Queue</span>
          <span>Sequential Crash-Safe Execution</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-neutral-400 uppercase font-mono">
              <tr>
                <th className="px-6 py-3">Recipient</th>
                <th className="px-6 py-3">Destination / Email</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Note</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action / Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{row.name}</td>
                  <td className="px-6 py-4 font-mono text-neutral-400 max-w-[200px] truncate">
                    {row.addressOrEmail}
                  </td>
                  <td className="px-6 py-4 font-bold text-neutral-200">${row.amount}</td>
                  <td className="px-6 py-4 text-neutral-400">{row.note}</td>
                  <td className="px-6 py-4">
                    {row.status === "idle" && (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-neutral-400">Idle</span>
                    )}
                    {row.status === "preparing" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Preparing</span>
                    )}
                    {row.status === "proving" && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 animate-pulse">Proving ZK</span>
                    )}
                    {row.status === "submitting" && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Relaying</span>
                    )}
                    {row.status === "sent" && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center gap-1 w-fit">
                        <CheckCircleIcon className="w-3.5 h-3.5" /> Sent
                      </span>
                    )}
                    {row.status === "error" && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1 w-fit" title={row.error}>
                        <ExclamationCircleIcon className="w-3.5 h-3.5" /> Error
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.claimLink ? (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(row.claimLink!);
                          alert("Claim link copied to clipboard!");
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 ml-auto font-medium"
                      >
                        <ShareIcon className="w-3.5 h-3.5" /> Copy Claim Link
                      </button>
                    ) : (
                      <span className="text-neutral-500">—</span>
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
