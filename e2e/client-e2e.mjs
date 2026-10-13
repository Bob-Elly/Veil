// Full-stack check on anvil: contracts + relayer (commitment cache, /relay) + @veil/sdk VeilPoolClient
// + the exact circuit artifacts shipped in apps/web/public/circuits.
//
//   anvil &                                   # in another terminal
//   (cd contracts && forge build)
//   node e2e/client-e2e.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { poseidonContract } from "circomlibjs";
import { VeilKeys, VeilPoolClient, formatAddress, createProver, decodeX402Header, buildPaymentSignature } from "../packages/sdk/dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = `${ROOT}/contracts/out`;
const art = (f, c) => JSON.parse(readFileSync(`${OUT}/${f}/${c}.json`, "utf8"));
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];
const [deployer, relayerAcct, bobPublic] = KEYS.map((k) => privateKeyToAccount(k));
const pub = createPublicClient({ chain: foundry, transport: http() });
const w = (acct) => createWalletClient({ account: acct, chain: foundry, transport: http() });

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); };
async function deploy(abi, bytecode, args = []) {
  const hash = await w(deployer).deployContract({ abi, bytecode, args });
  return (await pub.waitForTransactionReceipt({ hash })).contractAddress;
}

// ── deploy ──
const p2 = await deploy(poseidonContract.generateABI(2), poseidonContract.createCode(2));
const p3 = await deploy(poseidonContract.generateABI(3), poseidonContract.createCode(3));
const verifier = await deploy(art("Verifier.sol", "Groth16Verifier").abi, art("Verifier.sol", "Groth16Verifier").bytecode.object);
const tokenArt = art("MockERC20.sol", "MockERC20");
const token = await deploy(tokenArt.abi, tokenArt.bytecode.object);
const poolArt = art("VeilPool.sol", "VeilPool");
const pool = await deploy(poolArt.abi, poolArt.bytecode.object, [verifier, p2, p3, token, 1_000_000_000_000n]);
const deployBlock = Number(await pub.getBlockNumber());
const depFile = `${ROOT}/deployments/anvil.json`;
writeFileSync(depFile, JSON.stringify({ chainId: 31337, pools: { USDC: { address: pool, token, decimals: 6, deployBlock: 0 } } }, null, 2));

// ── relayer ──
const relayer = spawn("node", ["index.js"], {
  cwd: `${ROOT}/services/relayer`,
  env: { ...process.env, RELAYER_PK: KEYS[1], RPC_URL: "http://127.0.0.1:8545", DEPLOYMENTS: depFile, PORT: "3101", LOG_RANGE: "100" },
  stdio: ["ignore", "inherit", "inherit"],
});
process.on("exit", () => relayer.kill());
const RELAYER = "http://127.0.0.1:3101";
for (let i = 0; i < 50; i++) { try { await fetch(`${RELAYER}/status`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

// ── wallets ──
const wasm = new Uint8Array(readFileSync(`${ROOT}/apps/web/public/circuits/transaction2x2.wasm`));
const zkey = new Uint8Array(readFileSync(`${ROOT}/apps/web/public/circuits/transaction2x2_final.zkey`));
const prover = createProver(wasm, zkey);
const env = { chainId: 31337, relayerUrl: RELAYER, publicClient: pub };
const poolCfg = { symbol: "USDC", address: pool, token, decimals: 6 };
const aliceKeys = await VeilKeys.fromSeed(new Uint8Array(32).fill(1));
const bobKeys = await VeilKeys.fromSeed(new Uint8Array(32).fill(2));
const alice = new VeilPoolClient(env, poolCfg, aliceKeys);
const bob = new VeilPoolClient(env, poolCfg, bobKeys);
const U = (n) => BigInt(n) * 1_000_000n;
const tokBal = (a) => pub.readContract({ address: token, abi: tokenArt.abi, functionName: "balanceOf", args: [a] });

await w(deployer).writeContract({ address: token, abi: tokenArt.abi, functionName: "mint", args: [deployer.address, U(1000)] }).then((hash) => pub.waitForTransactionReceipt({ hash }));

// 1. deposits (depositTo: no proof)
await alice.deposit(w(deployer), U(10));
await alice.deposit(w(deployer), U(5));
await alice.sync();
ok(alice.balance === U(15), `alice private balance 15 after two deposits (got ${alice.balance})`);
ok(alice.leaves.length === 2, "relayer cache serves both leaves");

// 2. private send 12 → bob (needs both notes, change 3 back to alice)
let t = Date.now();
const tx1 = await alice.send(formatAddress(bobKeys), U(12), prover);
console.log(`      send took ${Date.now() - t} ms`);
ok(/^0x[0-9a-f]{64}$/.test(tx1), "send relayed");
await bob.sync();
ok(bob.balance === U(12), `bob sees 12 (got ${bob.balance})`);
ok(alice.balance === U(3), `alice change 3 (got ${alice.balance})`);

// 3. bob withdraws 7 to a public address
const before = await tokBal(bobPublic.address);
await bob.withdraw(bobPublic.address, U(7), prover);
ok((await tokBal(bobPublic.address)) - before === U(7), "bob public wallet received 7");
ok(bob.balance === U(5), `bob private balance 5 (got ${bob.balance})`);

// 4. merge path: alice now has notes 3,1,1,1 → paying 6 needs a merge first
for (let i = 0; i < 3; i++) await alice.deposit(w(deployer), U(1));
await alice.sync();
ok(alice.unspent.length === 4 && alice.balance === U(6), `alice has 4 notes totalling 6 (got ${alice.unspent.length} / ${alice.balance})`);
await alice.send(formatAddress(bobKeys), U(6), prover, (m) => console.log("      ·", m));
await bob.sync();
ok(alice.balance === 0n, `alice drained after merge+send (got ${alice.balance})`);
ok(bob.balance === U(11), `bob 11 (got ${bob.balance})`);

// 5. double spend is rejected by the relayer simulation
try {
  await alice.send(formatAddress(bobKeys), U(1), prover);
  ok(false, "overspend should fail");
} catch (e) {
  ok(/Insufficient/.test(e.message), `overspend refused locally (${e.message.slice(0, 60)})`);
}

// 6. fresh client (new device) recovers everything from the relayer cache
const bob2 = new VeilPoolClient(env, poolCfg, bobKeys);
await bob2.sync();
ok(bob2.balance === U(11), `fresh bob client recovers balance 11 (got ${bob2.balance})`);

// 7. x402 shielded payment to the demo merchant API
const api = spawn("node", ["index.js"], {
  cwd: `${ROOT}/apps/demo-api`,
  env: { ...process.env, DEPLOYMENTS: depFile, RELAYER_URL: RELAYER, PORT: "3102" },
  stdio: ["ignore", "inherit", "inherit"],
});
process.on("exit", () => api.kill());
for (let i = 0; i < 50; i++) { try { await fetch("http://127.0.0.1:3102/quote"); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const r1 = await fetch("http://127.0.0.1:3102/quote");
ok(r1.status === 402 && r1.headers.get("PAYMENT-REQUIRED"), "merchant answers 402 + PAYMENT-REQUIRED");
const reqs = decodeX402Header(r1.headers.get("PAYMENT-REQUIRED"));
const accepted = reqs.accepts.find((a) => a.scheme === "shielded");
const { proofArgs, extData } = await bob.preparePayment(accepted.payTo, BigInt(accepted.amount), BigInt(accepted.extra.fee), accepted.extra.relayer, prover);
const sigHeader = buildPaymentSignature(accepted, 31337, proofArgs, extData);
const r2 = await fetch("http://127.0.0.1:3102/quote", { headers: { "PAYMENT-SIGNATURE": sigHeader } });
const body = await r2.json();
ok(r2.status === 200 && body.quote, `paid request returns content (${r2.status} ${JSON.stringify(body).slice(0, 80)})`);
ok(!!r2.headers.get("PAYMENT-RESPONSE"), "PAYMENT-RESPONSE header present");
const r3 = await fetch("http://127.0.0.1:3102/quote", { headers: { "PAYMENT-SIGNATURE": sigHeader } });
ok(r3.status === 402, "replayed payment refused");
const merchant = new VeilPoolClient(env, poolCfg, await VeilKeys.fromSeed(new Uint8Array(32).fill(7)));
await merchant.sync();
ok(merchant.balance === 10000n, `merchant private balance 0.01 (got ${merchant.balance})`);
await bob.sync();
ok(bob.balance === U(11) - 10000n, `bob paid exactly 0.01 (got ${bob.balance})`);
api.kill();

console.log(`\n${pass} passed, ${fail} failed`);
relayer.kill();
process.exit(fail ? 1 : 0);
