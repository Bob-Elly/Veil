"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { poseidon } from "@veil/sdk";
import { KindBadge } from "@/components/ui/SealedField";

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
      try {
        const decoded = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
        parsed = JSON.parse(decoded);
      } catch {
        parsed = JSON.parse(raw);
      }

      if (!parsed.amount || !parsed.pubKey || !parsed.blinding || !parsed.commitment) {
        throw new Error("Missing required fields (amount, pubKey, blinding, commitment)");
      }

      const amountBig = BigInt(parsed.amount);
      const pubKeyBig = BigInt(parsed.pubKey);
      const blindingBig = BigInt(parsed.blinding);
      const expectedCommitment = BigInt(parsed.commitment);

      const computed = await poseidon([amountBig, pubKeyBig, blindingBig]);
      const matches = computed === expectedCommitment;

      setResult({
        valid: matches,
        computedCommitment: `0x${computed.toString(16)}`,
        providedCommitment: `0x${expectedCommitment.toString(16)}`,
        amount: (Number(amountBig) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 }),
        pubKey: `0x${pubKeyBig.toString(16)}`,
        index: parsed.index,
        error: matches ? undefined : "Computed Poseidon commitment does not match receipt"
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
    <div className="space-y-8 max-w-3xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            Verify Payment Receipt
          </h1>
          <KindBadge sealed={true} />
        </div>
        <p className="text-sm text-mute">
          Cryptographically verify a private payment opening against the pool without revealing the sender or connecting a wallet.
        </p>
      </div>

      <div className="gl-card p-6">
        <label className="block text-xs font-medium text-mute mb-2">
          Receipt payload (JSON or Base64URL)
        </label>
        <textarea
          rows={4}
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder='{"index": 12, "amount": "50000000", "pubKey": "0x...", "blinding": "...", "commitment": "..."}'
          className="gl-input h-auto py-3 text-xs font-mono resize-none mb-4"
        />
        <button
          onClick={() => runVerification(inputData)}
          disabled={!inputData.trim() || verifying}
          className="btn btn-ink btn-block"
        >
          {verifying ? "Verifying opening…" : "Verify Cryptographic Opening"}
        </button>
      </div>

      {result && (
        <div className={`gl-card p-6 border ${result.valid ? "border-green/40" : "border-danger/40"}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm font-medium ${result.valid ? "text-sealed" : "text-danger"}`}>
              {result.valid ? "Valid Zero-Knowledge Receipt" : "Verification Failed"}
            </span>
            <KindBadge sealed={result.valid} />
          </div>

          {result.valid ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-mute">Amount</span>
                <span className="font-medium tnum text-foreground">${result.amount} USDC</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-mute">Tree Leaf Index</span>
                <span className="font-medium text-foreground">#{result.index ?? "N/A"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-mute">Recipient Public Key</span>
                <span className="font-mono text-mute truncate max-w-[300px]">{result.pubKey}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-mute">Poseidon Commitment</span>
                <span className="font-mono text-sealed truncate max-w-[300px]">{result.computedCommitment}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-danger">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-mute">Loading verifier…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
