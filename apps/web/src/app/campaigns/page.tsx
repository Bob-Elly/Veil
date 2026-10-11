"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/components/Providers";
import { 
  MegaphoneIcon, 
  SparklesIcon, 
  ChartBarIcon, 
  PlusIcon,
  CheckCircleIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

type Campaign = {
  id: string;
  name: string;
  vaultAddress: string;
  requiredTag: string;
  requiredMention: string;
  ratePer1k: number;
  totalBudget: number;
  activePosts: number;
  paidOut: number;
  status: "active" | "completed";
};

export default function CampaignsPage() {
  const { session } = useApp();
  const [activeTab, setActiveTab] = useState<"founder" | "kol">("founder");
  
  // Demo campaigns state
  const [campaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "Monad Metropolis Launch KOL Push",
      vaultAddress: "0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560",
      requiredTag: "#ad",
      requiredMention: "@monad_xyz",
      ratePer1k: 15,
      totalBudget: 5000,
      activePosts: 14,
      paidOut: 1850,
      status: "active"
    }
  ]);

  // KOL register post form state
  const [postUrl, setPostUrl] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [registerStatus, setRegisterStatus] = useState<string | null>(null);

  const handleRegisterPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrl.trim()) return;
    setRegisterStatus("Submitting post registration to StreamVault...");
    setTimeout(() => {
      setRegisterStatus("Post successfully registered! Chainlink CRE will monitor impressions every 6 hours.");
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold tracking-wide uppercase">
            Chainlink CRE · Decentralized Runtime Environment
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">KOL Campaigns & StreamVault</h1>
        <p className="text-neutral-400 mt-1 max-w-2xl">
          Private, automated influencer marketing. StreamVault pools lock funds privately; Chainlink CRE oracle workflows read X metrics with decentralized node consensus to trigger shielded payouts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-8">
        <button
          onClick={() => setActiveTab("founder")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "founder" ? "text-white" : "text-neutral-400 hover:text-white"
          }`}
        >
          Founder Dashboard
          {activeTab === "founder" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("kol")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "kol" ? "text-white" : "text-neutral-400 hover:text-white"
          }`}
        >
          Creator / KOL View
          {activeTab === "kol" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
          )}
        </button>
      </div>

      {activeTab === "founder" ? (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Active Marketing Vaults</h2>
            <button
              onClick={() => alert("StreamVault Factory deployment initiated with salt.")}
              className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <PlusIcon className="w-4 h-4" />
              Create StreamVault Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {campaigns.map((camp) => (
              <div key={camp.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                        Active
                      </span>
                      <span className="text-xs font-mono text-neutral-500">Vault: {camp.vaultAddress.slice(0, 8)}...</span>
                    </div>
                    <h3 className="text-lg font-bold">{camp.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-400">Rate:</span>
                    <span className="font-bold text-white">${camp.ratePer1k} USDC / 1k Views</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-black/30 border border-white/5 mb-6 text-xs">
                  <div>
                    <span className="text-neutral-400 block mb-1">Total Shielded Budget</span>
                    <span className="text-base font-bold text-white">${camp.totalBudget.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block mb-1">Paid Out via CRE</span>
                    <span className="text-base font-bold text-emerald-400">${camp.paidOut.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block mb-1">Verified Posts</span>
                    <span className="text-base font-bold text-indigo-300">{camp.activePosts} Posts</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block mb-1">Rules Required</span>
                    <span className="text-neutral-200 font-mono">{camp.requiredTag} & {camp.requiredMention}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" /> CRE Consensus checks every 6h
                  </span>
                  <button className="text-indigo-400 hover:text-indigo-300 font-semibold">
                    Manage Whitelisted KOLs →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            <h3 className="text-lg font-bold mb-2">Register Your X Post</h3>
            <p className="text-xs text-neutral-400 mb-6">
              Paste your published post URL. StreamVault will link it to your whitelisted Veil address and the Chainlink CRE workflow will verify impressions and disburse shielded notes.
            </p>

            <form onSubmit={handleRegisterPost} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Your X Handle</label>
                <input
                  type="text"
                  placeholder="@yourhandle"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Post URL</label>
                <input
                  type="text"
                  placeholder="https://x.com/username/status/123456789"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-300">
                ⚠️ Post must include <span className="font-bold">#ad</span> and tag the campaign sponsor to pass CRE consensus aggregation.
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/30"
              >
                Register Post for Payouts
              </button>
            </form>

            {registerStatus && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">
                {registerStatus}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
              <h3 className="text-lg font-bold mb-4">How CRE Payouts Work</h3>
              <ol className="flex flex-col gap-3 text-xs text-neutral-300 list-decimal list-inside">
                <li><strong className="text-white">Post Registration:</strong> You register your post on-chain via StreamVault.</li>
                <li><strong className="text-white">Oracle Consensus:</strong> Decentralized Chainlink CRE nodes read public metrics via the X API and compute median valid impressions.</li>
                <li><strong className="text-white">Shielded Payout:</strong> StreamVault automatically inserts a private note into the Veil tree for your key.</li>
                <li><strong className="text-white">No Public Trace:</strong> No on-chain link between the sponsor treasury and your wallet address.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
