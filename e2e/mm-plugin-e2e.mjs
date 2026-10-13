// Runs the real `mm veil …` oclif commands against anvil with a stub MetaMask context
// (walletExecutor signs/sends with an anvil key). Run after client-e2e.mjs (reuses deployments/anvil.json).
import { readFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = `${ROOT}/packages/mm-plugin`;
process.env.HOME = mkdtempSync(path.join(os.tmpdir(), "veil-mm-"));
const dep = JSON.parse(readFileSync(`${ROOT}/deployments/anvil.json`, "utf8"));
const acct = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"); // anvil #3
const pub = createPublicClient({ chain: foundry, transport: http() });
const wal = createWalletClient({ account: acct, chain: foundry, transport: http() });

globalThis.mmContext = {
  session: { account: acct.address },
  walletExecutor: async (_cmd, _id, req) => {
    if (req.kind === "typed-data") return { signature: await acct.signTypedData(req.typedData) };
    const hash = await wal.sendTransaction({ to: req.transaction.to, data: req.transaction.data, value: 0n });
    await pub.waitForTransactionReceipt({ hash });
    return { status: "SUCCESS", transactionHash: hash };
  },
};
process.env.VEIL_DEPLOYMENTS = `${ROOT}/deployments/anvil.json`;
process.env.VEIL_RELAYER_URL = "http://127.0.0.1:3101";

const relayer = spawn("node", ["index.js"], { cwd: `${ROOT}/services/relayer`, env: { ...process.env, RELAYER_PK: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", RPC_URL: "http://127.0.0.1:8545", DEPLOYMENTS: process.env.VEIL_DEPLOYMENTS, PORT: "3101" }, stdio: "ignore" });
const api = spawn("node", ["index.js"], { cwd: `${ROOT}/apps/demo-api`, env: { ...process.env, DEPLOYMENTS: process.env.VEIL_DEPLOYMENTS, RELAYER_URL: "http://127.0.0.1:3101", PORT: "3102" }, stdio: "ignore" });
process.on("exit", () => { relayer.kill(); api.kill(); });
await new Promise((r) => setTimeout(r, 2500));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${m}`); };
const cmd = async (p, argv) => (await import(`${PLUGIN}/dist/commands/veil/${p}.js`)).default.run(argv, PLUGIN);
const C = ["--chain-id", "31337"];

// fund the MetaMask wallet with mock USDC
const mint = [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }];
await pub.waitForTransactionReceipt({ hash: await wal.writeContract({ address: dep.pools.USDC.token, abi: mint, functionName: "mint", args: [acct.address, 50_000_000n] }) });

const setup = await cmd("setup", C);
ok(setup.mode === "derived" && setup.veilAddress.startsWith("veil:0x"), "setup derives agent key from wallet signature");
const dpt = await cmd("deposit", ["--amount", "5", ...C]);
ok(dpt.status === "success", "deposit via walletExecutor (approve + depositTo)");
await new Promise((r) => setTimeout(r, 2500)); // relayer cache tick
let bal = await cmd("balance", C);
ok(bal.balance === "5000000", `balance 5 (got ${bal.balance})`);

try { await cmd("pay", ["--to", setup.veilAddress, "--amount", "1", ...C]); ok(false, "pay without guard should be denied"); }
catch (e) { ok(/Guard denies/.test(e.message), "pay denied when no guard policy"); }
await cmd("guard/set", ["--per-payment", "2", "--daily", "3", "--expires", "2030-01-01"]);
try { await cmd("pay", ["--to", setup.veilAddress, "--amount", "2.5", ...C]); ok(false, "over cap"); }
catch (e) { ok(/per-payment cap/.test(e.message), "pay over per-payment cap denied"); }

const x = await cmd("x402/fetch", ["http://127.0.0.1:3102/quote", "--max", "0.05", ...C]);
ok(x.status === 200 && x.payment?.success, `x402 fetch pays privately and gets content (${x.body?.slice(0, 50)})`);
const wd = await cmd("withdraw", ["--to", acct.address, "--amount", "1", ...C]);
ok(wd.status === "success", "withdraw relayed");
bal = await cmd("balance", C);
ok(bal.balance === String(5_000_000 - 10_000 - 1_000_000), `balance after x402 + withdraw (got ${bal.balance})`);
const rc = await cmd("receipt", C);
ok(rc.receipts.length >= 1, `receipts printed (${rc.receipts.length})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
