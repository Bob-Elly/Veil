"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { poseidon } from "@veil/sdk";
import { RELAYER_URL } from "@/lib/config";
import { KindBadge, SealDots } from "@/components/ui/SealedField";

type ReceiptData = {
  chainId?: number;
  pool?: string;
  index: number;
  commitment: string;
  amount: string;
  pubKey: string;
  blinding: string;
  memo?: string;
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
    memo?: string;
    onChain?: boolean | null;
    error?: string;
  } | null>(null);

  const loadPreset = async (type: "payroll" | "kol" | "ausd") => {
    let amountBig = 50_000_000n; // 50 USDC
    let pubKeyBig = 1884920194820194820194820194820194820194820194820194820194820194n;
    let blindingBig = 987654321098765432109876543210987654321098765432109876543210n;
    let index = 42;
    let memo = "Engineering Payroll (October)";

    if (type === "kol") {
      amountBig = 250_000_000n; // 250 USDC
      pubKeyBig = 4920194820194820194820194820194820194820194820194820194820194820n;
      blindingBig = 123456789012345678901234567890123456789012345678901234567890n;
      index = 128;
      memo = "StreamVault KOL Bounty: Monad Metropolis (#ad)";
    } else if (type === "ausd") {
      amountBig = 1_200_000_000n; // 1200 AUSD
      pubKeyBig = 7720194820194820194820194820194820194820194820194820194820194820n;
      blindingBig = 551092837465019283746501928374650192837465019283746501928374n;
      index = 256;
      memo = "Agora Cross-Border Settlement Invoice #884";
    }

    const commitment = await poseidon([amountBig, pubKeyBig, blindingBig]);
    const receiptObj: ReceiptData = {
      index,
      amount: amountBig.toString(),
      pubKey: `0x${pubKeyBig.toString(16)}`,
      blinding: `0x${blindingBig.toString(16)}`,
      commitment: `0x${commitment.toString(16)}`,
      memo
    };

    const str = JSON.stringify(receiptObj, null, 2);
    setInputData(str);
    runVerification(str);
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const param = searchParams.get("data");
    const data = hash || param;
    if (data) {
      setInputData(data);
      runVerification(data);
    } else {
      loadPreset("payroll");
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
      let matches = computed === expectedCommitment;

      // Is this commitment really leaf #index of the pool? (null = sample receipt with no pool)
      let onChain: boolean | null = null;
      if (parsed.pool && parsed.index !== undefined) {
        const res = await fetch(`${RELAYER_URL}/commitments?pool=${parsed.pool}&from=${parsed.index}`).then((r) => r.json());
        const leaf = res.commitments?.[0];
        onChain = !!leaf && Number(leaf.index) === Number(parsed.index) && BigInt(leaf.commitment) === computed;
        matches = matches && onChain;
      }

      setResult({
        valid: matches,
        computedCommitment: `0x${computed.toString(16)}`,
        providedCommitment: `0x${expectedCommitment.toString(16)}`,
        amount: (Number(amountBig) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 }),
        pubKey: `0x${pubKeyBig.toString(16)}`,
        index: parsed.index,
        memo: parsed.memo,
        onChain,
        error: matches ? undefined : onChain === false ? "Opening is self-consistent but no such commitment exists at that leaf in the pool" : "Computed Poseidon commitment does not match receipt opening"
      });
    } catch (e: any) {
      setResult({
        valid: false,
        error: e.message || "Failed to parse cryptographic receipt payload"
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            Verify Payment Receipt
          </h1>
          <KindBadge sealed={true} />
        </div>
        <p className="text-sm text-mute max-w-2xl">
          Cryptographically verify a private payment opening against the Monad shielded pool. Verifies exact dollar amount, recipient public key, and Merkle leaf commitment without connecting a wallet or revealing the payer.
        </p>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-mute mr-1">Try a sample receipt:</span>
        <button
          onClick={() => loadPreset("payroll")}
          className="btn btn-ghost btn-sm text-xs"
        >
          Load Payroll Receipt ($50)
        </button>
        <button
          onClick={() => loadPreset("kol")}
          className="btn btn-ghost btn-sm text-xs"
        >
          Load KOL Bounty Receipt ($250)
        </button>
        <button
          onClick={() => loadPreset("ausd")}
          className="btn btn-ghost btn-sm text-xs"
        >
          Load Agora AUSD Settlement ($1,200)
        </button>
      </div>

      <div className="gl-card p-6">
        <label className="block text-xs font-medium text-mute mb-2">
          Receipt Payload (JSON or Base64URL string)
        </label>
        <textarea
          rows={6}
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder='{"index": 42, "amount": "50000000", "pubKey": "0x...", "blinding": "0x...", "commitment": "0x..."}'
          className="gl-input h-auto py-3 text-xs font-mono resize-none mb-4"
        />
        <div className="flex justify-between items-center gap-4">
          <button
            onClick={() => runVerification(inputData)}
            disabled={!inputData.trim() || verifying}
            className="btn btn-ink flex-1"
          >
            {verifying ? "Computing Poseidon hash over inputs…" : "Verify Cryptographic Opening"}
          </button>
          {inputData && (
            <button
              onClick={() => {
                setInputData("");
                setResult(null);
              }}
              className="btn btn-ghost text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className={`gl-card p-6 border ${result.valid ? "border-green/40" : "border-danger/40"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${result.valid ? "bg-sealed" : "bg-danger"}`} />
              <span className={`text-base font-medium ${result.valid ? "text-sealed" : "text-danger"}`}>
                {result.valid ? "Valid Zero-Knowledge Payment Receipt" : "Cryptographic Verification Failed"}
              </span>
            </div>
            <KindBadge sealed={result.valid} />
          </div>

          {result.valid ? (
            <div className="space-y-3 text-xs">
              {result.memo && (
                <div className="flex justify-between py-2.5 border-b border-line">
                  <span className="text-mute">Verified Memo</span>
                  <span className="font-medium text-foreground">{result.memo}</span>
                </div>
              )}
              <div className="flex justify-between py-2.5 border-b border-line">
                <span className="text-mute">Verified Amount</span>
                <span className="font-medium tnum text-foreground text-sm">${result.amount}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-line">
                <span className="text-mute">Merkle Leaf Index</span>
                <span className="font-mono text-foreground">#{result.index ?? "N/A"}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-line">
                <span className="text-mute">Recipient Stealth Public Key</span>
                <span className="font-mono text-mute truncate max-w-[340px]">{result.pubKey}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-mute">Poseidon Hash Match</span>
                <span className="font-mono text-sealed truncate max-w-[340px]">{result.computedCommitment}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-mute">On-chain leaf</span>
                <span className={`font-mono ${result.onChain ? "text-sealed" : "text-mute"}`}>{result.onChain === null || result.onChain === undefined ? "sample receipt (no pool given)" : result.onChain ? `found at leaf #${result.index}` : "not found"}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-danger">{result.error}</p>
          )}
        </div>
      )}

      {/* Explanation Guide */}
      <div className="gl-card p-6">
        <h3 className="text-sm font-medium text-foreground mb-2">How Receipt Verification Works</h3>
        <p className="text-xs text-mute leading-relaxed mb-4">
          When a private payment occurs on Veil, the sender generates a cryptographic commitment: <code className="text-foreground">Commitment = Poseidon(amount, recipientPubKey, blinding)</code>. The commitment is permanently inserted into Monad&apos;s on-chain Merkle tree.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-surface border border-line">
            <span className="font-medium text-foreground block mb-1">1. Off-Chain Opening</span>
            <span className="text-mute">The sender gives the recipient the pre-image values (amount and blinding).</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface border border-line">
            <span className="font-medium text-foreground block mb-1">2. Zero Sender Leak</span>
            <span className="text-mute">The recipient can prove they were paid to any third-party auditor without revealing who paid them.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface border border-line">
            <span className="font-medium text-foreground block mb-1">3. Immutable Monad Tree</span>
            <span className="text-mute">Anyone can check the leaf index exists in the Monad contract without needing a private key.</span>
          </div>
        </div>
      </div>
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
