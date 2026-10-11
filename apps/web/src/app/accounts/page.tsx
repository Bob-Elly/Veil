"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/components/Providers";
import { KeyIcon, ClipboardDocumentCheckIcon, ArrowTopRightOnSquareIcon, ShieldCheckIcon, CpuChipIcon } from "@heroicons/react/24/outline";

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
        <KeyIcon className="w-16 h-16 text-neutral-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
        <p className="text-neutral-400 max-w-md">
          Authenticate with your Mera passkey on the dashboard to view your hierarchical derived keys.
        </p>
      </div>
    );
  }

  const mainVeilAddress = `veil:0x${session.keys.main.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.main.encPub).toString("hex")}`;
  const auditViewKey = `veilview:0x${session.keys.auditEnc.pubKey.toString(16).padStart(64, "0")}${Buffer.from(session.keys.auditEnc.encPub).toString("hex")}`;
  const atRestHex = `0x${Buffer.from(session.keys.atRestKey).toString("hex")}`;

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold tracking-wide uppercase">
            Mera: One Passkey, Many Keys
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Derived Accounts & Key Tree</h1>
        <p className="text-neutral-400 mt-1 max-w-2xl">
          A single PRF output from your passkey deterministically derives your public funding EOA, private spend key, shareable auditor viewing key, encrypted-at-rest vault key, and sub-agent identities (BIP-44 path <code className="text-indigo-300">m/44&apos;/60&apos;/0&apos;/0/i</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Public EOA (Index 0) */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/10 text-neutral-300">
                Index 0 · Public EOA
              </span>
              <span className="text-xs text-neutral-400">Gas & Funding</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Monad Public Wallet</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Pays gas, deposits into the pool, and receives withdrawals by default.
            </p>
            <div className="bg-black/30 p-3 rounded-2xl border border-white/5 font-mono text-xs break-all text-neutral-300">
              {session.publicAccount.address}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(session.publicAccount.address, "eoa")}
            className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold transition-colors"
          >
            <ClipboardDocumentCheckIcon className="w-4 h-4" />
            {copiedKey === "eoa" ? "Copied!" : "Copy Address"}
          </button>
        </div>

        {/* Main Veil Account (Index 1) */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-neutral-900 border border-indigo-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Index 1 · Primary Veil
              </span>
              <ShieldCheckIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Main Shielded Address</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Spend key + view key for your primary private pool balance.
            </p>
            <div className="bg-black/40 p-3 rounded-2xl border border-indigo-500/10 font-mono text-xs break-all text-neutral-300 max-h-20 overflow-y-auto">
              {mainVeilAddress}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(mainVeilAddress, "veil")}
            className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold transition-colors"
          >
            <ClipboardDocumentCheckIcon className="w-4 h-4" />
            {copiedKey === "veil" ? "Copied!" : "Copy Full Veil Address"}
          </button>
        </div>

        {/* Auditor View Key (Index 2) */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Index 2 · Compliance
              </span>
              <span className="text-xs text-neutral-400">Read-Only</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Shareable Auditor Key</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Share with an accountant or auditor. Can decrypt note memos to verify transaction history without spending rights.
            </p>
            <div className="bg-black/30 p-3 rounded-2xl border border-white/5 font-mono text-xs break-all text-neutral-300 max-h-20 overflow-y-auto">
              {auditViewKey}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(auditViewKey, "audit")}
            className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold transition-colors"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            {copiedKey === "audit" ? "Copied!" : "Export View Key"}
          </button>
        </div>

        {/* At-Rest Key (Index 3) */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Index 3 · Storage
              </span>
              <span className="text-xs text-neutral-400">AES-256-GCM</span>
            </div>
            <h3 className="text-lg font-bold mb-1">At-Rest Vault Key</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Protects cached unspent notes in browser localStorage (Gloam audit M-1 mitigation). Never leaves memory unencrypted.
            </p>
            <div className="bg-black/30 p-3 rounded-2xl border border-white/5 font-mono text-xs break-all text-neutral-400">
              {atRestHex.slice(0, 18)}...{atRestHex.slice(-10)} (Protected)
            </div>
          </div>
          <div className="mt-4 py-2 px-4 rounded-xl bg-white/5 text-center text-xs text-neutral-400">
            Active in Memory
          </div>
        </div>
      </div>

      {/* Agent Sub-Accounts (Indices 10 + k) */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
        <div className="flex flex-wrap justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
              <CpuChipIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Autonomous Agent Accounts</h3>
              <p className="text-xs text-neutral-400">
                Hierarchical sub-accounts (Indices 10 + k) provisioned for MetaMask Agent Wallet plugins and AI bots.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAgentCount(c => Math.min(10, c + 1))}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold transition-colors"
          >
            + Derive Next Agent Account
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentKeys.map(agent => (
            <div key={agent.index} className="bg-black/30 border border-white/5 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-mono text-neutral-400">
                  Agent #{agent.index} (Index {10 + agent.index})
                </span>
                <button
                  onClick={() => copyToClipboard(agent.address, `agent-${agent.index}`)}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  {copiedKey === `agent-${agent.index}` ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-xs text-neutral-300 truncate">
                {agent.address}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
