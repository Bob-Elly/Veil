import { defineChain } from "viem";
import { foundry, monadTestnet } from "viem/chains";
import type { VeilPoolConfig } from "@veil/sdk";

// All runtime config lives here. Defaults = Monad testnet deployment (deployments/testnet.json).
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || (CHAIN_ID === 31337 ? "http://127.0.0.1:8545" : "https://testnet-rpc.monad.xyz");
export const RELAYER_URL = (process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3001").replace(/\/$/, "");
export const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_URL || undefined;
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadvision.com";

export const CHAIN = CHAIN_ID === 31337 ? foundry : CHAIN_ID === 10143 ? monadTestnet : defineChain({ ...monadTestnet, id: CHAIN_ID });

export type AssetSymbol = "USDC" | "AUSD";

export const POOLS: Record<AssetSymbol, VeilPoolConfig & { mintable?: boolean }> = {
  USDC: {
    symbol: "USDC",
    address: (process.env.NEXT_PUBLIC_POOL_USDC || "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1") as `0x${string}`,
    token: (process.env.NEXT_PUBLIC_TOKEN_USDC || "0x534b2f3A21130d7a60830c2Df862319e593943A3") as `0x${string}`,
    decimals: 6,
    deployBlock: 69802319,
  },
  AUSD: {
    symbol: "AUSD",
    address: (process.env.NEXT_PUBLIC_POOL_AUSD || "0x409b1d63174407550f773d405e4068e147362d18") as `0x${string}`,
    // Testnet stand-in for Agora AUSD (MockERC20 with an open mint, so judges can try it).
    token: (process.env.NEXT_PUBLIC_TOKEN_AUSD || "0x1c4523f39341766b9088845a8240450025b03b1e") as `0x${string}`,
    decimals: 6,
    deployBlock: 69802329,
    mintable: true,
  },
};

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER_URL}/address/${a}`;
