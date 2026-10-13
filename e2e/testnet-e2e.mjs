// Real Monad testnet run on the AUSD pool (mock AUSD has an open mint).
//   RELAYER_URL=http://localhost:3001 FUNDER_PK=0x… node e2e/testnet-e2e.mjs
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { VeilKeys, VeilPoolClient, formatAddress, createProver } from "../packages/sdk/dist/index.js";

const RPC = "https://testnet-rpc.monad.xyz";
const dep = JSON.parse(readFileSync(new URL("../deployments/testnet.json", import.meta.url)));
const pool = dep.pools.AUSD;
const pub = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
const funder = privateKeyToAccount(process.env.FUNDER_PK);
const wal = createWalletClient({ account: funder, chain: monadTestnet, transport: http(RPC) });
const prover = createProver(new Uint8Array(readFileSync(new URL("../apps/web/public/circuits/transaction2x2.wasm", import.meta.url))), new Uint8Array(readFileSync(new URL("../apps/web/public/circuits/transaction2x2_final.zkey", import.meta.url))));
const env = { chainId: 10143, relayerUrl: process.env.RELAYER_URL || "http://localhost:3001", publicClient: pub };
const cfg = { symbol: "AUSD", address: pool.address, token: pool.token, decimals: 6 };
const rnd = () => crypto.getRandomValues(new Uint8Array(32));
const alice = new VeilPoolClient(env, cfg, await VeilKeys.fromSeed(rnd()));
const bobKeys = await VeilKeys.fromSeed(rnd());
const bob = new VeilPoolClient(env, cfg, bobKeys);
const U = (n) => BigInt(Math.round(n * 1e6));
const ERC = [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }, { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const tx = (h) => `https://testnet.monadvision.com/tx/${h}`;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; log(c ? "PASS" : "FAIL", m); };

log("funder", funder.address);
const g = await pub.estimateContractGas({ account: funder, address: pool.token, abi: ERC, functionName: "mint", args: [funder.address, U(20)] });
const mh = await wal.writeContract({ address: pool.token, abi: ERC, functionName: "mint", args: [funder.address, U(20)], gas: (g * 115n) / 100n });
await pub.waitForTransactionReceipt({ hash: mh });
log("minted 20 test AUSD", tx(mh));

let t = Date.now();
const d1 = await alice.deposit(wal, U(10)); log("deposit 10", tx(d1), `${Date.now() - t}ms`);
t = Date.now();
const d2 = await alice.deposit(wal, U(5)); log("deposit 5", tx(d2), `${Date.now() - t}ms`);
await alice.sync();
ok(alice.balance === U(15), `alice private balance 15 (got ${alice.balance})`);

t = Date.now();
const s1 = await alice.send(formatAddress(bobKeys), U(12), prover, (m) => log("  ·", m));
log("private send 12 → bob", tx(s1), `${Date.now() - t}ms`);
await bob.sync();
ok(bob.balance === U(12), `bob private balance 12 (got ${bob.balance})`);
ok(alice.balance === U(3), `alice change 3 (got ${alice.balance})`);

const recv = privateKeyToAccount(generatePrivateKey()).address;
t = Date.now();
const w1 = await bob.withdraw(recv, U(7), prover, (m) => log("  ·", m));
log("withdraw 7 → fresh address", recv, tx(w1), `${Date.now() - t}ms`);
const got = await pub.readContract({ address: pool.token, abi: ERC, functionName: "balanceOf", args: [recv] });
ok(got === U(7), `fresh address received 7 AUSD (got ${got})`);
ok(bob.balance === U(5), `bob private balance 5 (got ${bob.balance})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
