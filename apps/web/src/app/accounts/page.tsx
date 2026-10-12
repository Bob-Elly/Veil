"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/components/Providers";
import { loginOrRegister } from "@/lib/wallet";
import { KindBadge, SealDots } from "@/components/ui/SealedField";

export default function AccountsPage() {
  const { session } = useApp();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState(3);
  const [agentKeys, setAgentKeys] = useState<{ index: number; address: string; budget: string }[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    (async () => {
      const keys: { index: number; address: string; budget: string }[] = [];
      const defaultBudgets = ["500 USDC / day", "250 USDC / day", "1,000 USDC / day"];
      for (let i = 0; i < agentCount; i++) {
        const k = await session.keys.agent(i);
        keys.push({
          index: i,
          address: `veil:0x${k.pubKey.toString(16).padStart(64, "0")}${Buffer.from(k.encPub).toString("hex")}`,
          budget: defaultBudgets[i] || "100 USDC / day"
        });
      }
      if (isMounted) setAgentKeys(keys);
    })();
    return () => { isMounted = false; };
  }, [session, agentCount]);

  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      await loginOrRegister();
    } catch (e: any) {
      alert("Authentication failed: " + (e.message || "Cancelled"));
    } finally {
      setAuthLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16 text-center max-w-xl mx-auto">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-foreground mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="10" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <h2 className="text-2xl font-light text-foreground mb-2">Mera Passkey Required</h2>
        <p className="text-sm text-mute mb-6">
          Authenticate with your biometric passkey to inspect derived hierarchical keys, export auditor viewing keys, or provision sub-accounts for AI agents.
        </p>
        <button
          onClick={handleLogin}
          disabled={authLoading}
          className="btn btn-ink btn-lg"
        >
          {authLoading ? "Authenticating Passkey…" : "Sign In with Passkey →"}
        </button>
      </div>
    );
  }

  const mainVeilAddress = `veil:0x${session.keys.main.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.main.encPub).toString("hex")}`;
  const auditViewKey = `veilview:0x${session.keys.auditEnc.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.auditEnc.encPub).toString("hex")}`;
  const atRestHex = `0x${Buffer.from(session.keys.atRestKey).toString("hex")}`;

  const downloadAuditPack = () => {
    const pack = {
      version: "1.0",
      chain: "Monad Testnet (10143)",
      publicAddress: session.publicAccount.address,
      auditorViewingKey: auditViewKey,
      exportedAt: new Date().toISOString(),
      instructions: "Import into Veil Compliance Portal to decrypt memos and transaction values without spending capability."
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veil-auditor-pack-${session.publicAccount.address.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
              Accounts & Key Tree
            </h1>
            <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-mute font-mono">
              Mera BIP-44
            </span>
            <KindBadge sealed={true} />
          </div>
          <p className="text-sm text-mute max-w-2xl">
            A single WebAuthn passkey deterministically derives your public gas wallet, private spending keys, compliance viewing keys, and autonomous AI sub-accounts under <code className="text-foreground">m/44&apos;/60&apos;/0&apos;/0/i</code>.
          </p>
        </div>

        <button
          onClick={downloadAuditPack}
          className="btn btn-ghost btn-sm text-xs"
        >
          Download Compliance Pack (.json)
        </button>
      </div>

      {/* BIP-44 Tree Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Index 0: Public EOA */}
        <div className="gl-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-mute">Index 0 · Public EOA</span>
              <span className="text-xs text-mute">Gas & Funding</span>
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">Public Monad Address</h3>
            <p className="text-xs text-mute mb-4">
              Pays network gas and pulls deposits into the shielded pool.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-foreground break-all border border-line">
              {session.publicAccount.address}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(session.publicAccount.address, "eoa")}
            className="btn btn-ghost btn-sm mt-4 text-xs"
          >
            {copiedKey === "eoa" ? "Copied" : "Copy address"}
          </button>
        </div>

        {/* Index 1: Main Veil */}
        <div className="gl-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-mute">Index 1 · Primary Veil</span>
              <KindBadge sealed={true} />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">Primary Shielded Address</h3>
            <p className="text-xs text-mute mb-4">
              Spend key + viewing key for your private balances and incoming notes.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-foreground break-all max-h-20 overflow-y-auto border border-line">
              {mainVeilAddress}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(mainVeilAddress, "veil")}
            className="btn btn-ink btn-sm mt-4 text-xs"
          >
            {copiedKey === "veil" ? "Copied" : "Copy shielded address"}
          </button>
        </div>

        {/* Index 2: Auditor View Key */}
        <div className="gl-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-mute">Index 2 · Compliance</span>
              <span className="text-xs text-sealed font-medium">Read-only</span>
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">Auditor Viewing Key</h3>
            <p className="text-xs text-mute mb-4">
              Share with an accountant. Can decrypt memos and values without spend capability.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-foreground break-all max-h-20 overflow-y-auto border border-line">
              {auditViewKey}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(auditViewKey, "audit")}
            className="btn btn-ghost btn-sm mt-4 text-xs"
          >
            {copiedKey === "audit" ? "Copied" : "Export viewing key"}
          </button>
        </div>

        {/* Index 3: At-Rest Vault Key */}
        <div className="gl-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-mute">Index 3 · Storage</span>
              <span className="text-xs text-mute">AES-256-GCM</span>
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">At-Rest Vault Key</h3>
            <p className="text-xs text-mute mb-4">
              Encrypts cached unspent notes locally in browser IndexedDB.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-mute border border-line">
              {atRestHex.slice(0, 20)}…{atRestHex.slice(-12)} (Protected in session memory)
            </div>
          </div>
          <span className="mt-4 text-center text-xs text-mute py-2">
            Held in volatile session memory
          </span>
        </div>
      </div>

      {/* Sub-agents for MetaMask Agent Wallet (Track 04) */}
      <div className="gl-card p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-medium text-foreground">AI Agent Identities (Index 10 + k)</h3>
              <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[11px] text-mute font-mono">
                @veil/mm-plugin
              </span>
            </div>
            <p className="text-xs text-mute">
              Hierarchical sub-accounts provisioned for autonomous MetaMask Agent Wallet plugins with spending guardrails.
            </p>
          </div>
          <button
            onClick={() => setAgentCount(c => Math.min(10, c + 1))}
            className="btn btn-ghost btn-sm text-xs"
          >
            + Derive Next Agent Account
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agentKeys.map(agent => (
            <div key={agent.index} className="rounded-xl bg-surface p-4 flex flex-col justify-between gap-3 border border-line">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-medium text-foreground">
                    Agent #{agent.index + 1}
                  </span>
                  <span className="text-[10px] font-mono text-mute">
                    Index {10 + agent.index}
                  </span>
                </div>
                <span className="text-[11px] text-sealed block mb-2 font-medium">
                  Guardrail: {agent.budget}
                </span>
                <span className="font-mono text-[11px] text-mute truncate block bg-panel p-2 rounded-lg border border-line">
                  {agent.address.slice(0, 16)}…{agent.address.slice(-10)}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(agent.address, `agent-${agent.index}`)}
                className="btn btn-ghost btn-sm text-xs w-full"
              >
                {copiedKey === `agent-${agent.index}` ? "Copied" : "Copy Agent Address"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
