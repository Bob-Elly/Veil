"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/components/Providers";
import { KindBadge } from "@/components/ui/SealedField";

export default function AccountsPage() {
  const { session } = useApp();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState(2);
  const [agentKeys, setAgentKeys] = useState<{ index: number; address: string }[]>([]);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    (async () => {
      const keys: { index: number; address: string }[] = [];
      for (let i = 0; i < agentCount; i++) {
        const k = await session.keys.agent(i);
        keys.push({
          index: i,
          address: `veil:0x${k.pubKey.toString(16).padStart(64, "0")}${Buffer.from(k.encPub).toString("hex")}`
        });
      }
      if (isMounted) setAgentKeys(keys);
    })();
    return () => { isMounted = false; };
  }, [session, agentCount]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
        <h2 className="text-2xl font-light text-foreground mb-2">Sign in required</h2>
        <p className="text-sm text-mute max-w-sm">
          Authenticate with your Mera passkey on the home page to inspect your derived keys.
        </p>
      </div>
    );
  }

  const mainVeilAddress = `veil:0x${session.keys.main.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.main.encPub).toString("hex")}`;
  const auditViewKey = `veilview:0x${session.keys.auditEnc.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.auditEnc.encPub).toString("hex")}`;
  const atRestHex = `0x${Buffer.from(session.keys.atRestKey).toString("hex")}`;

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            Accounts & Key Tree
          </h1>
          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-mute font-mono">
            Mera BIP-44
          </span>
        </div>
        <p className="text-sm text-mute max-w-2xl">
          One passkey derives your public funding wallet, private spending key, auditor view key, and autonomous agent identities under <code className="text-foreground">m/44&apos;/60&apos;/0&apos;/0/i</code>.
        </p>
      </div>

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
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-foreground break-all">
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
              Spend key + viewing key for your private balances.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-foreground break-all max-h-20 overflow-y-auto">
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
              <span className="text-xs text-mute">Read-only</span>
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">Auditor Viewing Key</h3>
            <p className="text-xs text-mute mb-4">
              Share with an accountant. Can decrypt memos without spend capability.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-foreground break-all max-h-20 overflow-y-auto">
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
              Encrypts cached unspent notes locally in browser storage.
            </p>
            <div className="rounded-xl bg-surface p-3 font-mono text-xs text-mute">
              {atRestHex.slice(0, 18)}…{atRestHex.slice(-10)} (Protected)
            </div>
          </div>
          <span className="mt-4 text-center text-xs text-mute py-2">
            Held in session memory
          </span>
        </div>
      </div>

      {/* Sub-agents */}
      <div className="gl-card p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h3 className="text-base font-medium text-foreground">AI Agent Identities (Index 10 + k)</h3>
            <p className="text-xs text-mute">
              Hierarchical sub-accounts provisioned for autonomous MetaMask Agent Wallet plugins.
            </p>
          </div>
          <button
            onClick={() => setAgentCount(c => Math.min(10, c + 1))}
            className="btn btn-ghost btn-sm text-xs"
          >
            + Derive Next Agent Account
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentKeys.map(agent => (
            <div key={agent.index} className="rounded-xl bg-surface p-4 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <span className="text-xs font-mono text-mute block mb-1">
                  Agent #{agent.index} (Index {10 + agent.index})
                </span>
                <span className="font-mono text-xs text-foreground truncate block">
                  {agent.address}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(agent.address, `agent-${agent.index}`)}
                className="btn btn-ghost btn-sm text-xs shrink-0"
              >
                {copiedKey === `agent-${agent.index}` ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
