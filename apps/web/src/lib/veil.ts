import { createPublicClient, createWalletClient, formatUnits, http, parseUnits, toHex } from "viem";
import { VeilKeys, VeilPoolClient, formatAddress } from "@veil/sdk";
import { CHAIN, CHAIN_ID, ENVIO_URL, POOLS, RELAYER_URL, RPC_URL, type AssetSymbol } from "./config";
import type { VeilSession } from "./wallet";

export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

export function walletClientFor(session: VeilSession) {
  return createWalletClient({ account: session.publicAccount, chain: CHAIN, transport: http(RPC_URL) });
}

export function poolClient(keys: VeilKeys, symbol: AssetSymbol) {
  return new VeilPoolClient({ chainId: CHAIN_ID, relayerUrl: RELAYER_URL, envioUrl: ENVIO_URL, publicClient }, POOLS[symbol], keys);
}

export const bytesToHex = (b: Uint8Array) => toHex(b).slice(2);
export const hexToBytes = (h: string) => {
  const s = h.replace(/^0x/, "");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export const veilAddressOf = (keys: VeilKeys) => formatAddress(keys);

export const fmt = (units: bigint, decimals = 6) =>
  Number(formatUnits(units, decimals)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

export const parseAmount = (s: string, decimals = 6) => {
  const v = parseUnits(s.trim() || "0", decimals);
  if (v <= 0n) throw new Error("Amount must be greater than 0");
  return v;
};

/**
 * Pay someone who has no Veil account yet: create a one-time key, pay it, and hand them a
 * link carrying the seed in the URL #fragment (never sent to any server).
 */
export async function createClaimTarget() {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const keys = await VeilKeys.fromSeed(seed);
  return { address: formatAddress(keys), link: `${window.location.origin}/claim#${bytesToHex(seed)}` };
}

/** If the passkey's public EOA has no MON for gas, ask the relayer for a one-time drip. */
export async function ensureGas(session: VeilSession, onStatus?: (m: string) => void) {
  const bal = await publicClient.getBalance({ address: session.publicAccount.address });
  if (bal >= 5_000_000_000_000_000n) return; // 0.005 MON is plenty for approve + depositTo
  onStatus?.("Requesting a little MON for gas from the relayer…");
  const signature = await session.publicAccount.signMessage({ message: `veil-gas-drip:${session.publicAccount.address}:${CHAIN_ID}` });
  const res = await fetch(`${RELAYER_URL}/gas-drip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: session.publicAccount.address, chainId: CHAIN_ID, signature }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && json.error !== "balance_too_high") {
    throw new Error(`Your funding wallet ${session.publicAccount.address} needs testnet MON for gas (relayer drip: ${json.error || res.status}).`);
  }
  if (json.txHash) await publicClient.waitForTransactionReceipt({ hash: json.txHash });
}

const MINT_ABI = [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }] as const;
const ERC20_BAL = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }] as const;

export async function publicTokenBalance(symbol: AssetSymbol, owner: `0x${string}`) {
  return publicClient.readContract({ address: POOLS[symbol].token, abi: ERC20_BAL, functionName: "balanceOf", args: [owner] }) as Promise<bigint>;
}

/** Testnet only: mint test AUSD to the funding wallet. */
export async function mintTestTokens(session: VeilSession, symbol: AssetSymbol, amount: bigint) {
  const wc = walletClientFor(session);
  const gas = await publicClient.estimateContractGas({ account: session.publicAccount, address: POOLS[symbol].token, abi: MINT_ABI, functionName: "mint", args: [session.publicAccount.address, amount] });
  const hash = await wc.writeContract({ address: POOLS[symbol].token, abi: MINT_ABI, functionName: "mint", args: [session.publicAccount.address, amount], gas: (gas * 115n) / 100n });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
