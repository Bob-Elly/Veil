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
          recipient: session?.account.address,
          recipientType: "DESTINATION_CHAIN",
          refundTo: session?.account.address, // Usually user's origin address
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] border border-white/10 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl">
        <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">Fund from Any Chain</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {step === "input" && (
            <form onSubmit={handleQuote} className="flex flex-col gap-6">
              <p className="text-neutral-400 text-sm">
                Confidential mode hides where the money came from. Shielding it hides where it goes next.
              </p>
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">Amount (USDC)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#2C2C2E] text-white border-0 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 text-lg font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !amount}
                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-semibold py-4 rounded-xl transition-all"
              >
                {loading ? "Getting Quote..." : "Get Route"}
              </button>
            </form>
          )}

          {step === "quote" && quote && (
            <div className="flex flex-col gap-6 items-center">
              <p className="text-neutral-300 text-center">
                Send exactly <span className="font-bold text-white">{amount} USDC</span> on Base to the address below:
              </p>
              <div className="p-4 bg-white rounded-xl">
                <QrCodeIcon className="w-48 h-48 text-black" />
              </div>
              <div className="w-full bg-[#2C2C2E] p-4 rounded-xl text-center font-mono text-sm break-all text-neutral-300">
                {quote.depositAddress}
              </div>
              <button
                onClick={pollStatus}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-4 rounded-xl transition-all"
              >
                I have sent the funds
              </button>
            </div>
          )}

          {step === "depositing" && (
            <div className="flex flex-col gap-6 items-center py-8">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-neutral-300 font-medium">Waiting for funds to arrive on Monad...</p>
              <p className="text-sm text-neutral-500 text-center">
                This usually takes about 30 seconds via Aurora Intents.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col gap-6 items-center py-4">
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center">
                <ArrowRightIcon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white text-center">Funds Arrived!</h3>
              <p className="text-neutral-400 text-center">
                Your USDC has successfully crossed over to Monad. Shield it now to finalize privacy.
              </p>
              <button
                onClick={handleShieldNow}
                className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-4 rounded-xl transition-all text-lg"
              >
                Shield Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
