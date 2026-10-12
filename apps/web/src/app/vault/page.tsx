"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import { parseUnits, createWalletClient, http, erc20Abi, encodeFunctionData, parseAbiItem, publicActions } from "viem";
import { monadTestnet } from "viem/chains";
import { buildDeposit, buildTransfer, buildWithdraw, selectInputs, MerkleTree, VeilKeys } from "@veil/sdk";
import { getProver } from "@/lib/prover";
import { submitToRelayer } from "@/lib/relayer";
import { loginOrRegister } from "@/lib/wallet";
import { SealedField, SealDots, KindBadge } from "@/components/ui/SealedField";

const POOL_ADDRESS = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1";
const USDC_TOKEN = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const AUSD_TOKEN = "0x409b1d63174407550f773d405e4068e147362d18";
const RELAYER_ADDRESS = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";

const transactAbi = [
  parseAbiItem("function transact((uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 publicAmount, uint256 extDataHash, uint256[2] inputNullifiers, uint256[2] outputCommitments) proof, (address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2) extData) external")
];

function VaultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "shield";
  const [tab, setTab] = useState<"shield" | "move" | "cashout" | "fund">(
    initialTab === "move" || initialTab === "cashout" || initialTab === "fund" ? initialTab : "shield"
  );

  const { session, notes, isSyncing, triggerSync } = useApp();
  const [assetChoice, setAssetChoice] = useState<"USDC" | "AUSD">("USDC");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState<string | null>(null);

  // Cross-chain fund state
  const [fundQuote, setFundQuote] = useState<{ depositAddress: string; expiresAt: number } | null>(null);

  const unspentNotes = useMemo(() => notes.filter(n => !n.spent), [notes]);
  const balance = useMemo(() => unspentNotes.reduce((a, b) => a + b.amount, 0n), [unspentNotes]);
  const formattedBalance = (Number(balance) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleTabChange = (newTab: "shield" | "move" | "cashout" | "fund") => {
    setTab(newTab);
    setStatus(null);
    setError(null);
    setTxHash(null);
    setClaimLink(null);
  };

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

  // 1. SHIELD / ADD
  const handleShield = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !amount) return;
    try {
      setError(null);
      setTxHash(null);
      setStatus("Preparing Groth16 zero-knowledge proof…");

      const amountUnits = parseUnits(amount, 6);
      if (amountUnits <= 0n) throw new Error("Amount must be greater than 0");

      const prover = await getProver();
      const tree = new MerkleTree();
      for (const n of notes) {
        if (n.commitment) await tree.insert(n.commitment);
      }

      const { proofArgs, extData } = await buildDeposit(amountUnits, session.keys.main, tree, prover);

      setStatus(`Approving ${assetChoice} on Monad…`);
      const client = createWalletClient({
        account: session.publicAccount,
        chain: monadTestnet,
        transport: http("https://testnet-rpc.monad.xyz/")
      }).extend(publicActions);

      const tokenAddr = assetChoice === "USDC" ? USDC_TOKEN : AUSD_TOKEN;

      const approveGas = await client.estimateContractGas({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [POOL_ADDRESS, amountUnits],
        account: session.publicAccount
      });

      const approveTx = await client.writeContract({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [POOL_ADDRESS, amountUnits],
        gas: (approveGas * 115n) / 100n
      });

      setStatus("Waiting for Monad block confirmation…");
      await client.waitForTransactionReceipt({ hash: approveTx });

      setStatus("Submitting shielded transaction to pool…");
      const args = [
        proofArgs,
        {
          recipient: extData.recipient as `0x${string}`,
          extAmount: extData.extAmount,
          relayer: extData.relayer as `0x${string}`,
          fee: extData.fee,
          encryptedOutput1: extData.encryptedOutput1 as `0x${string}`,
          encryptedOutput2: extData.encryptedOutput2 as `0x${string}`
        }
      ] as const;

      const tx = await client.writeContract({
        address: POOL_ADDRESS,
        abi: transactAbi,
        functionName: "transact",
        args,
        gas: 2_500_000n
      });

      await client.waitForTransactionReceipt({ hash: tx });
      setTxHash(tx);
      setStatus("Deposit shielded successfully into private balance!");
      setAmount("");
      triggerSync();
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message || "Failed to shield funds");
      setStatus(null);
    }
  };

  // 2. PAY / SEND PRIVATELY
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !amount || !recipient) return;
    try {
      setError(null);
      setTxHash(null);
      setClaimLink(null);
      setStatus("Selecting unspent notes and proving Groth16 transfer…");

      const amountUnits = parseUnits(amount, 6);
      const selection = selectInputs(unspentNotes, amountUnits);

      let targetAddress = recipient.trim();
      let generatedClaim: string | null = null;

      if (!targetAddress.startsWith("veil:0x")) {
        const seed = crypto.getRandomValues(new Uint8Array(32));
        const claimKeys = await VeilKeys.fromSeed(seed);
        targetAddress = `veil:0x${claimKeys.pubKey.toString(16).padStart(64, "0")}${Buffer.from(claimKeys.encPub).toString("hex")}`;
        const seedHex = Buffer.from(seed).toString("hex");
        generatedClaim = `${window.location.origin}/claim#${seedHex}`;
        setClaimLink(generatedClaim);
      }

      const prover = await getProver();
      const tree = new MerkleTree();
      for (const n of notes) {
        if (n.commitment) await tree.insert(n.commitment);
      }

      setStatus("Computing Poseidon commitments & nullifiers…");
      const { proofArgs, extData } = await buildTransfer(
        targetAddress,
        amountUnits,
        0n,
        RELAYER_ADDRESS,
        selection.inputs,
        session.keys.main,
        tree,
        prover
      );

      setStatus("Relaying private transfer anonymously…");
      const res = await submitToRelayer(POOL_ADDRESS, proofArgs, extData);
      setTxHash(res.txHash);
      setStatus("Payment completed with zero metadata leakage!");
      setAmount("");
      setRecipient("");
      triggerSync();
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message || "Failed to complete private payment");
      setStatus(null);
    }
  };

  // 3. CASH OUT / WITHDRAW
  const handleCashout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !amount || !recipient) return;
    try {
      setError(null);
      setTxHash(null);
      setStatus("Proving unshield zero-knowledge circuit…");

      const amountUnits = parseUnits(amount, 6);
      const selection = selectInputs(unspentNotes, amountUnits);

      const prover = await getProver();
      const tree = new MerkleTree();
      for (const n of notes) {
        if (n.commitment) await tree.insert(n.commitment);
      }

      setStatus("Verifying tree root & spending nullifiers…");
      const { proofArgs, extData } = await buildWithdraw(
        recipient.trim(),
        amountUnits,
        0n,
        RELAYER_ADDRESS,
        selection.inputs,
        session.keys.main,
        tree,
        prover
      );

      setStatus("Submitting unshield via gas relayer…");
      const res = await submitToRelayer(POOL_ADDRESS, proofArgs, extData);
      setTxHash(res.txHash);
      setStatus("Funds unshielded to destination address!");
      setAmount("");
      setRecipient("");
      triggerSync();
    } catch (e: any) {
      console.error(e);
      setError(e.shortMessage || e.message || "Failed to withdraw funds");
      setStatus(null);
    }
  };

  // 4. CROSS-CHAIN FUNDING
  const handleFundQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    try {
      setError(null);
      setStatus("Fetching Aurora Intents route from Base…");
      // Simulate/request quote
      setTimeout(() => {
        setFundQuote({
          depositAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          expiresAt: Date.now() + 15 * 60 * 1000
        });
        setStatus(null);
      }, 800);
    } catch (e: any) {
      setError(e.message || "Failed to route cross-chain deposit");
      setStatus(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-foreground">
            Vault
          </h1>
          <KindBadge sealed={true} />
        </div>
        <p className="text-sm text-mute max-w-2xl">
          Add money privately, send it, and cash out, all in one place. Your balances and recipients stay completely hidden.
        </p>
      </div>

      {/* Segmented Action Tabs (Gloam Vault track) */}
      <div
        role="tablist"
        aria-label="Vault actions"
        className="inline-flex max-w-full rounded-full bg-surface p-1 dark:bg-panel dark:ring-1 dark:ring-line"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shield"}
          onClick={() => handleTabChange("shield")}
          className={`h-10 whitespace-nowrap rounded-full px-5 text-[14px] transition-colors duration-200 ${
            tab === "shield"
              ? "bg-panel font-medium text-foreground shadow-card"
              : "text-mute hover:text-foreground"
          }`}
        >
          Add / Shield
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "move"}
          onClick={() => handleTabChange("move")}
          className={`h-10 whitespace-nowrap rounded-full px-5 text-[14px] transition-colors duration-200 ${
            tab === "move"
              ? "bg-panel font-medium text-foreground shadow-card"
              : "text-mute hover:text-foreground"
          }`}
        >
          Pay Privately
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cashout"}
          onClick={() => handleTabChange("cashout")}
          className={`h-10 whitespace-nowrap rounded-full px-5 text-[14px] transition-colors duration-200 ${
            tab === "cashout"
              ? "bg-panel font-medium text-foreground shadow-card"
              : "text-mute hover:text-foreground"
          }`}
        >
          Cash Out
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "fund"}
          onClick={() => handleTabChange("fund")}
          className={`h-10 whitespace-nowrap rounded-full px-5 text-[14px] transition-colors duration-200 ${
            tab === "fund"
              ? "bg-panel font-medium text-foreground shadow-card"
              : "text-mute hover:text-foreground"
          }`}
        >
          Fund from Base
        </button>
      </div>

      {/* Main Two-Column Surface */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Form Card */}
        <div className="gl-card p-6 sm:p-8 min-w-0">
          {!session ? (
            <div className="text-center py-10 space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-foreground mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h2 className="text-xl font-light text-foreground">Sign in to access your Vault</h2>
              <p className="text-sm text-mute max-w-md mx-auto">
                Authenticate with your biometric passkey to unlock your private spending keys and shielded balances.
              </p>
              <button
                onClick={handleLogin}
                disabled={authLoading}
                className="btn btn-ink btn-lg mt-4"
              >
                {authLoading ? "Authenticating…" : "Unlock with Passkey →"}
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: SHIELD / ADD */}
              {tab === "shield" && (
                <form onSubmit={handleShield} className="space-y-6">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">Add money privately</h2>
                    <p className="text-xs text-mute mt-1">
                      Move funds from your public Monad wallet into your private shielded balance. From there you can pay anyone without the amount showing up.
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-surface p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-mute font-medium">You deposit</span>
                      <div className="flex items-center gap-2">
                        <span className="text-mute font-mono">From: {session.publicAccount.address.slice(0, 6)}…{session.publicAccount.address.slice(-4)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0.00"
                        className="tnum min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-light text-foreground outline-none placeholder:text-faint"
                      />
                      <select
                        value={assetChoice}
                        onChange={(e) => setAssetChoice(e.target.value as any)}
                        className="rounded-full bg-panel px-3.5 py-1.5 text-xs font-medium text-foreground shadow-card border-none outline-none cursor-pointer"
                      >
                        <option value="USDC">USDC (Monad)</option>
                        <option value="AUSD">Agora AUSD</option>
                      </select>
                    </div>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="flex justify-center -my-3 relative z-10">
                    <div className="grid h-8 w-8 place-items-center rounded-full border-4 border-panel bg-sealed-soft text-sealed shadow-xs">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-surface p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-mute font-medium">Into your private balance</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-sealed">
                        <span className="h-1.5 w-1.5 rounded-full bg-sealed" />
                        Only you
                      </span>
                    </div>
                    <p className="tnum text-2xl font-light text-foreground">
                      {amount && Number(amount) > 0 ? amount : "0.00"} <span className="text-sm text-mute">{assetChoice}</span>
                    </p>
                  </div>

                  <dl className="divide-y divide-line text-xs">
                    <div className="flex justify-between py-2.5">
                      <dt className="text-mute">Network</dt>
                      <dd className="text-foreground font-mono">Monad Testnet (Chain ID 10143)</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-mute">Zero-Knowledge Circuit</dt>
                      <dd className="text-foreground">Groth16 BN254 2-in / 2-out</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-mute">Privacy Guarantee</dt>
                      <dd className="text-sealed font-medium">Unlinkable Merkle tree note</dd>
                    </div>
                  </dl>

                  <button
                    type="submit"
                    disabled={!amount || Number(amount) <= 0 || !!status}
                    className="btn btn-ink btn-block btn-lg"
                  >
                    {status ? status : `Add ${assetChoice} Privately`}
                  </button>
                </form>
              )}

              {/* TAB 2: PAY PRIVATELY */}
              {tab === "move" && (
                <form onSubmit={handlePay} className="space-y-6">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">Pay privately</h2>
                    <p className="text-xs text-mute mt-1">
                      Transfer shielded notes to any Veil stealth address or email/X handle. Amounts and sender identities are never revealed on-chain.
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-surface p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-mute font-medium">Amount to send</span>
                      <button
                        type="button"
                        onClick={() => setAmount((Number(balance) / 1_000_000).toString())}
                        className="text-mute hover:text-foreground transition-colors"
                      >
                        Balance: <span className="font-medium text-foreground">${formattedBalance}</span> (Max)
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0.00"
                        className="tnum min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-light text-foreground outline-none placeholder:text-faint"
                      />
                      <select
                        value={assetChoice}
                        onChange={(e) => setAssetChoice(e.target.value as any)}
                        className="rounded-full bg-panel px-3.5 py-1.5 text-xs font-medium text-foreground shadow-card border-none outline-none cursor-pointer"
                      >
                        <option value="USDC">USDC</option>
                        <option value="AUSD">Agora AUSD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-mute mb-2">
                      Recipient (Veil address or email for claim link)
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="veil:0x... or alice@company.xyz"
                      className="gl-input font-mono text-xs"
                    />
                    <p className="text-[11px] text-mute mt-1.5">
                      Non-Veil recipients automatically receive a private, one-time off-chain claim link.
                    </p>
                  </div>

                  <dl className="divide-y divide-line text-xs">
                    <div className="flex justify-between py-2.5">
                      <dt className="text-mute">Gas & Relayer Fee</dt>
                      <dd className="text-sealed font-medium">Sponsored ($0.00)</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-mute">On-Chain Identity</dt>
                      <dd className="text-foreground/70"><SealDots n={6} /></dd>
                    </div>
                  </dl>

                  <button
                    type="submit"
                    disabled={!amount || !recipient || !!status}
                    className="btn btn-ink btn-block btn-lg"
                  >
                    {status ? status : "Send Privately"}
                  </button>
                </form>
              )}

              {/* TAB 3: CASH OUT */}
              {tab === "cashout" && (
                <form onSubmit={handleCashout} className="space-y-6">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">Cash out to public wallet</h2>
                    <p className="text-xs text-mute mt-1">
                      Unshield tokens from the pool directly to any standard Monad EOA or exchange address. The destination sees incoming funds from the pool without linking back to your origin deposits.
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-surface p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-mute font-medium">Withdraw amount</span>
                      <button
                        type="button"
                        onClick={() => setAmount((Number(balance) / 1_000_000).toString())}
                        className="text-mute hover:text-foreground transition-colors"
                      >
                        Available: <span className="font-medium text-foreground">${formattedBalance}</span> (Max)
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0.00"
                        className="tnum min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-light text-foreground outline-none placeholder:text-faint"
                      />
                      <span className="text-sm font-medium text-foreground">USDC</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-mute mb-2">
                      Destination Public Monad Address
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="0x..."
                      className="gl-input font-mono text-xs"
                    />
                    <div className="flex justify-end mt-1">
                      <button
                        type="button"
                        onClick={() => setRecipient(session.publicAccount.address)}
                        className="text-[11px] text-mute hover:text-foreground"
                      >
                        Use my EOA address
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!amount || !recipient || !!status}
                    className="btn btn-ink btn-block btn-lg"
                  >
                    {status ? status : "Cash Out Funds"}
                  </button>
                </form>
              )}

              {/* TAB 4: FUND FROM BASE */}
              {tab === "fund" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">Fund directly from Base</h2>
                    <p className="text-xs text-mute mt-1">
                      Bridge & confidential-swap USDC from Base directly into your Monad shielded pool balance using Aurora Intents.
                    </p>
                  </div>

                  {!fundQuote ? (
                    <form onSubmit={handleFundQuote} className="space-y-4">
                      <div className="rounded-[18px] bg-surface p-4 sm:p-5">
                        <label className="block text-xs font-medium text-mute mb-2">Amount to bridge & shield</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder="0.00"
                            className="tnum min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-light text-foreground outline-none placeholder:text-faint"
                          />
                          <span className="text-sm font-medium text-foreground">USDC (Base)</span>
                        </div>
                      </div>

                      <dl className="divide-y divide-line text-xs">
                        <div className="flex justify-between py-2">
                          <span className="text-mute">Source Chain</span>
                          <span className="text-foreground">Base Mainnet (8453)</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-mute">Settlement Target</span>
                          <span className="text-foreground">Monad Testnet Shielded Note</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-mute">Estimated Settlement</span>
                          <span className="text-sealed font-medium">~45 seconds</span>
                        </div>
                      </dl>

                      <button
                        type="submit"
                        disabled={!amount || !!status}
                        className="btn btn-ink btn-block btn-lg"
                      >
                        {status ? status : "Get Cross-Chain Route"}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-6 text-center">
                      <div className="p-4 rounded-2xl bg-surface border border-line">
                        <span className="text-xs text-mute block mb-1">Send exact amount on Base to:</span>
                        <p className="font-mono text-xs text-foreground break-all bg-panel p-3 rounded-xl border border-line select-all">
                          {fundQuote.depositAddress}
                        </p>
                        <span className="text-[11px] text-mute mt-2 block">
                          Expires in 15 minutes · Aurora Intent Solver will automatically execute the shielded deposit on Monad.
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setFundQuote(null);
                          setAmount("");
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        ← Start another quote
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status / Feedback message */}
              {status && (
                <div className="p-3.5 rounded-xl bg-surface border border-line flex items-center gap-2.5 text-xs text-foreground">
                  <span className="h-2 w-2 rounded-full bg-sealed animate-pulse shrink-0" />
                  <span>{status}</span>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-danger">
                  {error}
                </div>
              )}

              {txHash && (
                <div className="p-4 rounded-xl bg-sealed-soft/50 border border-sealed/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-sealed">Transaction Confirmed</span>
                    <KindBadge sealed={true} />
                  </div>
                  <div className="font-mono text-[11px] text-mute break-all">
                    Tx: {txHash}
                  </div>
                  {claimLink && (
                    <div className="pt-2 border-t border-line text-left">
                      <span className="text-xs font-medium text-foreground block mb-1">Private Claim Link:</span>
                      <input
                        type="text"
                        readOnly
                        value={claimLink}
                        className="gl-input text-xs font-mono select-all"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Rail (Gloam Asides) */}
        <aside className="space-y-4">
          {/* Private Balance Summary */}
          <div className="gl-card p-5">
            <div className="flex items-center justify-between text-xs text-mute mb-2">
              <span>Your Private Balance</span>
              <span className={`inline-flex items-center gap-1 text-[11px] ${isSyncing ? "text-amber-500" : "text-sealed"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? "bg-amber-500 animate-pulse" : "bg-sealed"}`} />
                {isSyncing ? "Syncing" : "Ready"}
              </span>
            </div>
            <p className="tnum text-3xl font-light text-foreground">
              ${session ? formattedBalance : "0.00"}
            </p>
            <p className="text-[11px] text-mute mt-1">
              {notes.length} unspent notes in local encrypted store
            </p>

            <div className="mt-4 pt-4 border-t border-line flex gap-2">
              <button
                onClick={() => triggerSync()}
                disabled={isSyncing}
                className="btn btn-ghost btn-sm text-xs flex-1"
              >
                {isSyncing ? "Syncing…" : "Refresh Tree"}
              </button>
            </div>
          </div>

          {/* What the Explorer Shows (Gloam signature card) */}
          <div className="gl-card p-5">
            <p className="text-[13px] text-mute">What the explorer shows</p>
            <dl className="mt-3 divide-y divide-line text-[13px]">
              <div className="flex h-10 items-center justify-between gap-3">
                <dt className="text-mute">Transaction</dt>
                <dd className="text-foreground">transact()</dd>
              </div>
              <div className="flex h-10 items-center justify-between gap-3">
                <dt className="text-mute">Sender identity</dt>
                <dd className="text-foreground/70"><SealDots n={6} /></dd>
              </div>
              <div className="flex h-10 items-center justify-between gap-3">
                <dt className="text-mute">Recipient identity</dt>
                <dd className="text-foreground/70"><SealDots n={6} /></dd>
              </div>
              <div className="flex h-10 items-center justify-between gap-3">
                <dt className="text-mute">Amount transferred</dt>
                <dd className="text-foreground/70"><SealDots n={6} /></dd>
              </div>
              <div className="flex h-10 items-center justify-between gap-3">
                <dt className="text-mute">Nullifier on-chain</dt>
                <dd className="text-sealed font-mono text-xs">Spent (No double-spend)</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-relaxed text-mute">
              MonadVision only sees zk-SNARK cryptographic verification. Zero knowledge of balances or counterparties.
            </p>
          </div>

          {/* ZK Verifier Info */}
          <div className="gl-card p-5">
            <span className="text-[13px] text-mute block mb-2">Cryptographic Stack</span>
            <ul className="space-y-1.5 text-xs text-mute">
              <li className="flex justify-between">
                <span>Curve:</span>
                <span className="font-mono text-foreground">BN254 (alt_bn128)</span>
              </li>
              <li className="flex justify-between">
                <span>Proof System:</span>
                <span className="text-foreground">Groth16 ZK-SNARK</span>
              </li>
              <li className="flex justify-between">
                <span>Hash Function:</span>
                <span className="text-foreground">Poseidon (2-ary, 3-ary)</span>
              </li>
              <li className="flex justify-between">
                <span>Tree Depth:</span>
                <span className="text-foreground">20 (1,048,576 leaves)</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function VaultPage() {
  return (
    <Suspense fallback={<div className="p-8 text-mute">Loading Vault…</div>}>
      <VaultContent />
    </Suspense>
  );
}
