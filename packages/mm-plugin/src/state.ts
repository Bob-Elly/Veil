import fs from "fs";
import path from "path";
import os from "os";

export function getVeilDir() {
  const dir = path.join(os.homedir(), ".veil");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getAgentKeyPath(walletAddress: string, chainId: number) {
  return path.join(getVeilDir(), `agent-${walletAddress.toLowerCase()}-${chainId}.json`);
}

export function getGuardPath(walletAddress: string) {
  return path.join(getVeilDir(), `guard-${walletAddress.toLowerCase()}.json`);
}

export function readAgentKey(walletAddress: string, chainId: number) {
  const p = getAgentKeyPath(walletAddress, chainId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function writeAgentKey(walletAddress: string, chainId: number, data: any) {
  const p = getAgentKeyPath(walletAddress, chainId);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), { mode: 0o600 });
}
