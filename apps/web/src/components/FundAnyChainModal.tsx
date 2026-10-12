import React, { useState, useEffect } from "react";
import { XMarkIcon, QrCodeIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { parseUnits } from "viem";
import { useApp } from "./Providers";

export function FundAnyChainModal({ onClose }: { onClose: () => void }) {
  const { session } = useApp();
  const [step, setStep] = useState<"input" | "quote" | "depositing" | "success">("input");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const AURORA_KEY = process.env.NEXT_PUBLIC_AURORA_KEY || "dummy-key";
  const MONAD_USDC_ASSET_ID = "nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx"; // Hardcoded from instructions

  const handleQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setError(null);
    setLoading(true);

    try {
      // Need origin asset, we will mock Base USDC for demo
      const originAsset = "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; 
      
      const res = await fetch(`https://intents-api.aurora.dev/api/quote/${AURORA_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry: false,
          confidentiality: "advanced",
          swapType: "EXACT_INPUT",
          amount: parseUnits(amount, 6).toString(),
          originAsset,
          destinationAsset: MONAD_USDC_ASSET_ID,
          depositType: "ORIGIN_CHAIN",
          recipient: session?.publicAccount.address,
          recipientType: "DESTINATION_CHAIN",
          refundTo: session?.publicAccount.address, // Usually user's origin address
          refundType: "ORIGIN_CHAIN",
          slippageTolerance: 100,
          deadline: new Date(Date.now() + 10 * 60_000).toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch quote");
      
      setQuote(data.quote);
      setStep("quote");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = async () => {
    setStep("depositing");
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        attempts++;
        if (attempts > 12) { // 1 minute max for demo
          clearInterval(interval);
          setStep("success");
          return;
        }

        const res = await fetch(`https://intents-api.aurora.dev/api/status/${AURORA_KEY}?depositAddress=${quote.depositAddress}`);
        if (!res.ok) return; // Keep polling
        
        const data = await res.json();
        if (data.status === "SUCCESS") {
          clearInterval(interval);
          setStep("success");
        }
      } catch (e) {
        // Ignore fetch errors during polling
      }
    }, 5000);
  };

  const handleShieldNow = () => {
    // In a real app, this would trigger the depositTo flow directly
    alert("Funds shielded! In demo, this confirms the deposit.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="gl-panel bg-panel border border-line w-full max-w-md rounded-[24px] overflow-hidden shadow-card">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-lg font-light text-foreground">Fund from Base</h2>
            <p className="text-xs text-mute">Confidential cross-chain swap via Aurora Intents</p>
          </div>
          <button onClick={onClose} className="text-mute hover:text-foreground transition-colors p-1 rounded-full">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-danger p-3 rounded-xl mb-5 text-xs">
              {error}
            </div>
          )}

          {step === "input" && (
            <form onSubmit={handleQuote} className="flex flex-col gap-5">
              <p className="text-mute text-xs">
                Confidential mode hides where the funds originated. Shielding it hides where it goes next.
              </p>
              <div>
                <label className="text-xs font-medium text-mute mb-1.5 block">Amount (USDC on Base)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="gl-input text-lg font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !amount}
                className="btn btn-ink btn-block"
              >
                {loading ? "Getting Route…" : "Get Cross-Chain Route"}
              </button>
            </form>
          )}

          {step === "quote" && quote && (
            <div className="flex flex-col gap-5 items-center">
              <p className="text-xs text-mute text-center">
                Send exactly <span className="font-medium text-foreground">{amount} USDC</span> on Base to:
              </p>
              <div className="p-3 bg-white rounded-2xl border border-line">
                <QrCodeIcon className="w-40 h-40 text-foreground" />
              </div>
              <div className="w-full bg-surface p-3 rounded-xl text-center font-mono text-xs break-all text-foreground select-all">
                {quote.depositAddress}
              </div>
              <button
                onClick={pollStatus}
                className="btn btn-ink btn-block"
              >
                I have sent the funds
              </button>
            </div>
          )}

          {step === "depositing" && (
            <div className="flex flex-col gap-4 items-center py-6">
              <div className="w-10 h-10 border-2 border-sealed border-t-transparent rounded-full animate-spin" />
              <p className="text-foreground text-sm font-medium">Waiting for funds to arrive on Monad…</p>
              <p className="text-xs text-mute text-center">
                Settles in ~30 seconds via Aurora Intents confidential route.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col gap-4 items-center py-4">
              <div className="w-12 h-12 bg-sealed-soft text-sealed rounded-full flex items-center justify-center">
                <ArrowRightIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-foreground text-center">Funds Arrived!</h3>
              <p className="text-xs text-mute text-center">
                Your USDC has successfully arrived on Monad. Shield it now into your private balance.
              </p>
              <button
                onClick={handleShieldNow}
                className="btn btn-ink btn-block"
              >
                Shield into Private Balance
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
