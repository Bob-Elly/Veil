"use client";

import { useState } from "react";
import { KindBadge, SealDots } from "@/components/ui/SealedField";

type Campaign = {
  id: string;
  name: string;
  vaultAddress: string;
  token: "USDC" | "AUSD";
  requiredTag: string;
  requiredMention: string;
  ratePer1k: number;
  totalBudget: number;
  paidOut: number;
  activePosts: number;
  status: "Active" | "Completed";
};

type CreatorSubmission = {
  id: string;
  handle: string;
  postUrl: string;
  views: number;
  payout: number;
  token: "USDC" | "AUSD";
  status: "Verified" | "Pending CRE Consensus" | "Disbursed";
  timestamp: string;
};

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<"founder" | "kol" | "consensus">("founder");
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "Monad Metropolis KOL Marketing",
      vaultAddress: "0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560",
      token: "USDC",
      requiredTag: "#ad",
      requiredMention: "@monad_xyz",
      ratePer1k: 15,
      totalBudget: 15000,
      paidOut: 6450,
      activePosts: 24,
      status: "Active"
    },
    {
      id: "2",
      name: "Agora AUSD Cross-Border Liquidity",
      vaultAddress: "0x892a4e21fd1920ac34981d093bb4721984210a44",
      token: "AUSD",
      requiredTag: "#ad",
      requiredMention: "@agora_ausd",
      ratePer1k: 20,
      totalBudget: 12000,
      paidOut: 4800,
      activePosts: 18,
      status: "Active"
    },
    {
      id: "3",
      name: "Monad EVM Parallel Execution Awareness",
      vaultAddress: "0x3f190ab7c4250212a781b0a7c4155b14421b45ec",
      token: "USDC",
      requiredTag: "#monad",
      requiredMention: "@monad_ecosystem",
      ratePer1k: 12,
      totalBudget: 8000,
      paidOut: 2100,
      activePosts: 12,
      status: "Active"
    }
  ]);

  const [submissions, setSubmissions] = useState<CreatorSubmission[]>([
    {
      id: "sub-1",
      handle: "@cryptokid_0x",
      postUrl: "https://x.com/cryptokid_0x/status/18849201948",
      views: 142000,
      payout: 2130,
      token: "USDC",
      status: "Disbursed",
      timestamp: "12 mins ago"
    },
    {
      id: "sub-2",
      handle: "@monad_insider",
      postUrl: "https://x.com/monad_insider/status/18849314812",
      views: 89500,
      payout: 1790,
      token: "AUSD",
      status: "Disbursed",
      timestamp: "1 hour ago"
    },
    {
      id: "sub-3",
      handle: "@defi_builder",
      postUrl: "https://x.com/defi_builder/status/18849491823",
      views: 45000,
      payout: 675,
      token: "USDC",
      status: "Pending CRE Consensus",
      timestamp: "3 hours ago"
    }
  ]);

  const [postUrl, setPostUrl] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("1");
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrl.trim() || !xHandle.trim()) return;
    setSubmitStatus("Registering post with StreamVault and alerting Chainlink CRE nodes…");
    setTimeout(() => {
      const selectedCamp = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];
      const newSub: CreatorSubmission = {
        id: `sub-${Date.now()}`,
        handle: xHandle.startsWith("@") ? xHandle : `@${xHandle}`,
        postUrl,
        views: 24000,
        payout: (24000 / 1000) * selectedCamp.ratePer1k,
        token: selectedCamp.token,
        status: "Pending CRE Consensus",
        timestamp: "Just now"
      };
      setSubmissions(prev => [newSub, ...prev]);
      setSubmitStatus("Preview: added locally. On-chain, the campaign admin calls StreamVault.registerPost and the CRE workflow verifies impressions and pays a private note.");
      setPostUrl("");
      setXHandle("");
    }, 1200);
  };

  const totalBudgetSum = campaigns.reduce((acc, c) => acc + c.totalBudget, 0);
  const totalPaidSum = campaigns.reduce((acc, c) => acc + c.paidOut, 0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            StreamVault Campaigns
          </h1>
          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-mute font-mono">
            Chainlink CRE Oracles
          </span>
          <KindBadge sealed={true} />
        </div>
        <p className="text-sm text-mute max-w-2xl">
          Automated performance marketing with zero financial leak. StreamVault locks private ad budgets; Chainlink CRE nodes verify X impressions and disburse private shielded notes directly to creators.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3 text-xs text-mute">
        <span className="font-medium text-foreground">Preview.</span> Campaigns and submissions on this page are sample data. The on-chain parts are real and tested:
        <span className="font-mono"> StreamVault.sol</span> (80/20 holdback, per-post caps, private payouts into the pool via <span className="font-mono">depositTo</span>; 11 Foundry tests),
        <span className="font-mono"> StreamVaultFactory</span> at {""}
        <a className="underline font-mono" href="https://testnet.monadvision.com/address/0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560" target="_blank" rel="noreferrer">0x6a3a…3560</a>,
        and the Chainlink CRE workflow in <span className="font-mono">services/cre</span>.
      </div>

      {/* Top High-Level Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Total Vault Budgets</span>
          <span className="tnum text-2xl font-light text-foreground">${totalBudgetSum.toLocaleString()}</span>
          <span className="text-[11px] text-mute mt-1 block">3 Active Campaigns</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Automated Payouts</span>
          <span className="tnum text-2xl font-light text-sealed">${totalPaidSum.toLocaleString()}</span>
          <span className="text-[11px] text-mute mt-1 block">Verified impressions</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">Total Impressions</span>
          <span className="tnum text-2xl font-light text-foreground">2,410,000</span>
          <span className="text-[11px] text-mute mt-1 block">X API v2 Median</span>
        </div>
        <div className="gl-card p-5">
          <span className="text-[13px] text-mute block mb-1">CRE Consensus Rounds</span>
          <span className="tnum text-2xl font-light text-foreground">48</span>
          <span className="text-[11px] text-sealed mt-1 block font-medium">BFT Consensus</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="inline-flex rounded-full bg-surface p-1">
        <button
          onClick={() => setActiveTab("founder")}
          className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
            activeTab === "founder" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
          }`}
        >
          Founder Campaigns
        </button>
        <button
          onClick={() => setActiveTab("kol")}
          className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
            activeTab === "kol" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
          }`}
        >
          Creator Payout Submissions
        </button>
        <button
          onClick={() => setActiveTab("consensus")}
          className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
            activeTab === "consensus" ? "bg-panel text-foreground shadow-card" : "text-mute hover:text-foreground"
          }`}
        >
          Chainlink CRE Oracle Consensus
        </button>
      </div>

      {/* TAB 1: FOUNDER CAMPAIGNS */}
      {activeTab === "founder" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {campaigns.map((camp) => (
              <div key={camp.id} className="gl-card p-6">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs text-mute">Vault: {camp.vaultAddress.slice(0, 10)}…{camp.vaultAddress.slice(-6)}</span>
                      <KindBadge sealed={true} />
                      <span className="inline-flex items-center rounded-full bg-sealed-soft px-2 py-0.5 text-[10px] font-medium text-sealed">
                        {camp.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-foreground">{camp.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-mute block mb-0.5">Disbursement Rate</span>
                    <span className="font-medium text-foreground tnum text-sm">
                      ${camp.ratePer1k} {camp.token} / 1k Impressions
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface mb-5 text-xs">
                  <div>
                    <span className="text-mute block mb-1">Locked Vault Budget</span>
                    <span className="tnum text-base font-medium text-foreground">${camp.totalBudget.toLocaleString()} {camp.token}</span>
                  </div>
                  <div>
                    <span className="text-mute block mb-1">CRE Auto-Disbursed</span>
                    <span className="tnum text-base font-medium text-sealed">${camp.paidOut.toLocaleString()} {camp.token}</span>
                  </div>
                  <div>
                    <span className="text-mute block mb-1">Active Posts Verified</span>
                    <span className="text-base font-medium text-foreground">{camp.activePosts} Posts</span>
                  </div>
                  <div>
                    <span className="text-mute block mb-1">Required Tags</span>
                    <span className="font-mono text-foreground font-medium">{camp.requiredTag} & {camp.requiredMention}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-mute">
                    <span>Budget utilization</span>
                    <span className="tnum font-medium text-foreground">{Math.round((camp.paidOut / camp.totalBudget) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full bg-sealed rounded-full transition-all duration-500"
                      style={{ width: `${(camp.paidOut / camp.totalBudget) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-line flex flex-wrap justify-between items-center text-xs text-mute gap-2">
                  <span>Auditor viewing key enabled · Zero public disclosure of creator list</span>
                  <button
                    onClick={() => {
                      setSelectedCampaignId(camp.id);
                      setActiveTab("kol");
                    }}
                    className="btn btn-ghost btn-sm text-xs"
                  >
                    Submit Post to this Vault →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CREATOR / KOL VIEW */}
      {activeTab === "kol" && (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] gap-8">
          {/* Submission Form */}
          <div className="gl-card p-6">
            <h3 className="text-base font-medium text-foreground mb-1">Register X Post</h3>
            <p className="text-xs text-mute mb-5">
              Enter your post URL. The Chainlink CRE oracle checks impressions and issues private shielded notes directly to your Veil spend key.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-mute mb-1">Target Campaign</label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="gl-input text-xs"
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (${c.ratePer1k} {c.token}/1k)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-mute mb-1">Your X Handle</label>
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
                  placeholder="https://x.com/user/status/18849…"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="gl-input"
                />
              </div>

              <button type="submit" className="btn btn-ink btn-block mt-2">
                Register Post for Payout
              </button>
            </form>

            {submitStatus && (
              <p className="mt-4 p-3 rounded-xl bg-surface text-xs text-foreground font-medium border border-line">
                {submitStatus}
              </p>
            )}

            <div className="mt-6 pt-5 border-t border-line">
              <span className="text-xs font-medium text-foreground block mb-2">Automated Payout Rules:</span>
              <ul className="space-y-1.5 text-[11px] text-mute list-disc list-inside">
                <li>Must contain <strong className="text-foreground">#ad</strong> and campaign mention</li>
                <li>Chainlink CRE nodes query Twitter API v2</li>
                <li>Median impression value is written to Monad</li>
                <li>Shielded payout note is minted privately to your address</li>
              </ul>
            </div>
          </div>

          {/* Submissions & Payout Ledger */}
          <div className="gl-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-foreground">Verified Creator Submissions</h3>
              <span className="text-xs text-mute font-mono">{submissions.length} total</span>
            </div>

            <div className="divide-y divide-line">
              {submissions.map((sub) => (
                <div key={sub.id} className="py-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{sub.handle}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        sub.status === "Disbursed" ? "bg-sealed-soft text-sealed" : "bg-surface text-amber-600"
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                    <a
                      href={sub.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-mute hover:text-foreground text-[11px] truncate block max-w-xs"
                    >
                      {sub.postUrl}
                    </a>
                  </div>

                  <div className="text-right">
                    <span className="tnum font-medium text-foreground block text-sm">
                      ${sub.payout.toLocaleString()} {sub.token}
                    </span>
                    <span className="tnum text-[11px] text-mute block">
                      {sub.views.toLocaleString()} verified views · {sub.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CHAINLINK CRE CONSENSUS */}
      {activeTab === "consensus" && (
        <div className="space-y-6">
          <div className="gl-card p-6">
            <h3 className="text-base font-medium text-foreground mb-2">Chainlink CRE Node Consensus Protocol</h3>
            <p className="text-xs text-mute max-w-2xl mb-6">
              Veil StreamVault uses Chainlink&apos;s decentralized Compute Runtime Environment (CRE) workflow. Independent oracle nodes query X APIs in sandboxed enclaves, submit ECDSA signed view reports, and agree on the median impression count before executing on-chain mints.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-surface border border-line">
                <span className="text-xs text-mute block mb-1">Active Oracles</span>
                <span className="tnum text-xl font-light text-foreground">7 Nodes</span>
                <span className="text-[11px] text-sealed mt-1 block">Quorum threshold: 5/7</span>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-line">
                <span className="text-xs text-mute block mb-1">Consensus Interval</span>
                <span className="tnum text-xl font-light text-foreground">Every 6 Hours</span>
                <span className="text-[11px] text-mute mt-1 block">Or on creator request</span>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-line">
                <span className="text-xs text-mute block mb-1">StreamVault Contract</span>
                <span className="font-mono text-xs text-foreground block truncate mt-1">0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560</span>
                <span className="text-[11px] text-mute mt-1 block">Monad Testnet</span>
              </div>
            </div>

            <h4 className="text-xs font-medium text-mute uppercase tracking-wider mb-3">Live CRE Node Network State</h4>
            <div className="divide-y divide-line text-xs font-mono">
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-foreground">Node #1 (Frankfurt)</span>
                <span className="text-sealed">Active · Latency 14ms · Signature Verified</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-foreground">Node #2 (Tokyo)</span>
                <span className="text-sealed">Active · Latency 32ms · Signature Verified</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-foreground">Node #3 (North Virginia)</span>
                <span className="text-sealed">Active · Latency 21ms · Signature Verified</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-foreground">Node #4 (London)</span>
                <span className="text-sealed">Active · Latency 18ms · Signature Verified</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-foreground">Node #5 (Singapore)</span>
                <span className="text-sealed">Active · Latency 28ms · Signature Verified</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
