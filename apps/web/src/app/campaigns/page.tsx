"use client";

import { useState } from "react";
import { KindBadge } from "@/components/ui/SealedField";

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
};

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<"founder" | "kol">("founder");
  const [campaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "Monad Metropolis KOL Marketing",
      vaultAddress: "0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560",
      requiredTag: "#ad",
      requiredMention: "@monad_xyz",
      ratePer1k: 15,
      totalBudget: 5000,
      activePosts: 14,
      paidOut: 1850
    }
  ]);
  const [postUrl, setPostUrl] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrl.trim()) return;
    setStatus("Submitting post to StreamVault…");
    setTimeout(() => {
      setStatus("Post registered! Chainlink CRE oracle will verify impressions and disburse shielded notes.");
    }, 1200);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            StreamVault Campaigns
          </h1>
          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-mute font-mono">
            Chainlink CRE
          </span>
        </div>
        <p className="text-sm text-mute max-w-2xl">
          Automated influencer marketing on Monad. StreamVault locks private budgets; decentralized Chainlink nodes achieve consensus over X view metrics to trigger shielded note payouts.
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-full bg-surface p-1">
        <button
          onClick={() => setActiveTab("founder")}
          className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
            activeTab === "founder" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
          }`}
        >
          Founder Dashboard
        </button>
        <button
          onClick={() => setActiveTab("kol")}
          className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
            activeTab === "kol" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
          }`}
        >
          Creator / KOL View
        </button>
      </div>

      {activeTab === "founder" ? (
        <div className="space-y-6">
          {campaigns.map((camp) => (
            <div key={camp.id} className="gl-card p-6">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-mute">Vault: {camp.vaultAddress.slice(0, 10)}…</span>
                    <KindBadge sealed={true} />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">{camp.name}</h3>
                </div>
                <div className="text-xs text-mute">
                  Rate: <span className="font-medium text-foreground tnum">${camp.ratePer1k} USDC / 1k Views</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface mb-6 text-xs">
                <div>
                  <span className="text-mute block mb-1">Total Budget</span>
                  <span className="tnum text-base font-medium text-foreground">${camp.totalBudget.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-mute block mb-1">CRE Payouts</span>
                  <span className="tnum text-base font-medium text-sealed">${camp.paidOut.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-mute block mb-1">Active Posts</span>
                  <span className="text-base font-medium text-foreground">{camp.activePosts} Posts</span>
                </div>
                <div>
                  <span className="text-mute block mb-1">Required Tags</span>
                  <span className="font-mono text-foreground">{camp.requiredTag} & {camp.requiredMention}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-mute">
                <span>Chainlink CRE workflow consensus runs every 6h</span>
                <span className="text-sealed font-medium">StreamVault Active</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="gl-card p-6">
            <h3 className="text-base font-medium text-foreground mb-1">Register X Post</h3>
            <p className="text-xs text-mute mb-4">
              Enter your post URL. The CRE oracle checks views and StreamVault automatically issues private notes to your address.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-mute mb-1">X Handle</label>
                <input
                  type="text"
                  placeholder="@handle"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  className="gl-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-mute mb-1">Post URL</label>
                <input
                  type="text"
                  placeholder="https://x.com/user/status/12345"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="gl-input"
                />
              </div>

              <button type="submit" className="btn btn-ink btn-block mt-2">
                Register Post for Payout
              </button>
            </form>

            {status && (
              <p className="mt-4 p-3 rounded-xl bg-surface text-xs text-foreground font-medium">
                {status}
              </p>
            )}
          </div>

          <div className="gl-card p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-medium text-foreground mb-3">Verification Rules</h3>
              <ul className="space-y-2 text-xs text-mute list-disc list-inside">
                <li>Post must include tag <strong className="text-foreground">#ad</strong></li>
                <li>Post must mention <strong className="text-foreground">@monad_xyz</strong></li>
                <li>Chainlink CRE nodes query Twitter API v2 independently</li>
                <li>Consensus takes the median impression count across nodes</li>
                <li>Shielded payout notes are minted directly to your Veil spend key</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-line text-xs text-mute">
              Decentralized oracle runtime environment
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
