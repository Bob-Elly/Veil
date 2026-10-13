import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, http, defineChain } from "viem";
import { monadTestnet } from "viem/chains";
import { VeilKeys, VeilPoolClient, createProver } from "@veil/sdk";

// Config via env: VEIL_RELAYER_URL, VEIL_RPC_URL, VEIL_ENVIO_URL, VEIL_DEPLOYMENTS (path), VEIL_CIRCUITS_DIR.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");

export function deployments(chainId: number) {
  const file = process.env.VEIL_DEPLOYMENTS || path.join(REPO, "deployments", chainId === 10143 ? "testnet.json" : chainId === 31337 ? "anvil.json" : "mainnet.json");
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  if (d.chainId !== chainId) throw new Error(`deployments file ${file} is for chain ${d.chainId}, not ${chainId}`);
  return d;
}

export function poolClient(chainId: number, symbol: string, keys: VeilKeys) {
  const d = deployments(chainId);
  const p = d.pools[symbol.toUpperCase()];
  if (!p) throw new Error(`no ${symbol} pool on chain ${chainId}`);
  const rpc = process.env.VEIL_RPC_URL || (chainId === 31337 ? "http://127.0.0.1:8545" : "https://testnet-rpc.monad.xyz");
  const chain = chainId === 10143 ? monadTestnet : defineChain({ ...monadTestnet, id: chainId });
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  return new VeilPoolClient(
    { chainId, relayerUrl: process.env.VEIL_RELAYER_URL || "http://localhost:3001", envioUrl: process.env.VEIL_ENVIO_URL, publicClient },
    { symbol: symbol.toUpperCase(), address: p.address, token: p.token, decimals: p.decimals },
    keys,
  );
}

let prover: any;
export function nodeProver() {
  if (prover) return prover;
  const dir = process.env.VEIL_CIRCUITS_DIR || path.join(REPO, "apps/web/public/circuits");
  prover = createProver(new Uint8Array(fs.readFileSync(path.join(dir, "transaction2x2.wasm"))), new Uint8Array(fs.readFileSync(path.join(dir, "transaction2x2_final.zkey"))));
  return prover;
}
