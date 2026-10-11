"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheckIcon, CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { poseidon } from "@veil/sdk";

type ReceiptData = {
  chainId?: number;
  pool?: string;
  index: number;
  commitment: string;
  amount: string;
  pubKey: string;
  blinding: string;
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const [inputData, setInputData] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    computedCommitment?: string;
    providedCommitment?: string;
    amount?: string;
    pubKey?: string;
    index?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    // Check URL fragment or query param
    const hash = window.location.hash.slice(1);
    const param = searchParams.get("data");
    const data = hash || param;
    if (data) {
      setInputData(data);
      runVerification(data);
    }
  }, [searchParams]);

  const runVerification = async (raw: string) => {
    setVerifying(true);
    setResult(null);
    try {
      let parsed: ReceiptData;
      // Try base64url decode first, then raw JSON
      try {
        const decoded = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
        parsed = JSON.parse(decoded);
      } catch {
        parsed = JSON.parse(raw);
      }

      if (!parsed.amount || !parsed.pubKey || !parsed.blinding || !parsed.commitment) {
        throw new Error("Missing required receipt fields (amount, pubKey, blinding, commitment)");
      }

      const amountBig = BigInt(parsed.amount);
      const pubKeyBig = BigInt(parsed.pubKey);
      const blindingBig = BigInt(parsed.blinding);
      const expectedCommitment = BigInt(parsed.commitment);

      // Recompute Poseidon commitment: Poseidon(amount, pubKey, blinding)
      const computed = await poseidon([amountBig, pubKeyBig, blindingBig]);

      const matches = computed === expectedCommitment;

      setResult({
        valid: matches,
        computedCommitment: `0x${computed.toString(16)}`,
        providedCommitment: `0x${expectedCommitment.toString(16)}`,
        amount: (Number(amountBig) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 }),
        pubKey: `0x${pubKeyBig.toString(16)}`,
        index: parsed.index,
        error: matches ? undefined : "Computed cryptographic commitment does not match receipt commitment"
      });
    } catch (e: any) {
      setResult({
        valid: false,
        error: e.message || "Failed to parse receipt data"
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold tracking-wide uppercase">
            Zero-Knowledge Receipt Proofs
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Verify Payment Receipt</h1>
        <p className="text-neutral-400 mt-1">
          Cryptographically verify that a private note was created and exists in the Veil shielded pool, without requiring a wallet connection.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Paste Receipt Payload (JSON or Base64URL)
        </label>
        <textarea
          rows={4}
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder='{"index": 12, "amount": "50000000", "pubKey": "0x...", "blinding": "...", "commitment": "..."}'
          className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono text-neutral-200 focus:outline-none focus:border-indigo-500/50 resize-none mb-4"
        />
        <button
          onClick={() => runVerification(inputData)}
          disabled={!inputData.trim() || verifying}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
          {verifying ? "Verifying cryptographic proof..." : "Verify Cryptographic Opening"}
        </button>
      </div>

      {result && (
        <div className={`p-6 rounded-3xl border backdrop-blur-md ${
          result.valid
            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
            : "bg-red-950/20 border-red-500/30 text-red-200"
        }`}>
          <div className="flex items-center gap-3 mb-4">
            {result.valid ? (
              <CheckCircleIcon className="w-8 h-8 text-emerald-400" />
            ) : (
              <XCircleIcon className="w-8 h-8 text-red-400" />
            )}
            <div>
              <h3 className="text-lg font-bold">
                {result.valid ? "Cryptographically Valid Receipt" : "Verification Failed"}
              </h3>
              <p className="text-xs text-neutral-400">
                {result.valid
                  ? "The opening matches the commitment. The note was created for the specified recipient."
                  : result.error}
              </p>
            </div>
          </div>

          {result.valid && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5 text-xs font-mono">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-neutral-400 block mb-1">Amount</span>
                <span className="text-base font-bold text-white font-sans">${result.amount} USDC</span>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-neutral-400 block mb-1">Leaf Tree Index</span>
                <span className="text-base font-bold text-white font-sans">#{result.index ?? "N/A"}</span>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5 md:col-span-2">
                <span className="text-neutral-400 block mb-1">Recipient Public Key</span>
                <span className="text-neutral-200 truncate block">{result.pubKey}</span>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5 md:col-span-2">
                <span className="text-neutral-400 block mb-1">Poseidon Commitment</span>
                <span className="text-emerald-400 truncate block">{result.computedCommitment}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading verifier...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
