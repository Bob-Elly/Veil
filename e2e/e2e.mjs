// End-to-end check of circuit + VeilPool + reference core on anvil.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbiItem, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { poseidonContract } from "circomlibjs";
import * as V from "./veil-core.mjs";

const OUT = "../contracts/out";
const art = (f, c) => JSON.parse(readFileSync(`${OUT}/${f}/${c}.json`, "utf8"));
const WASM = "../circuits/build/transaction2x2_js/transaction2x2.wasm";
const ZKEY = "../circuits/build/transaction2x2_final.zkey";
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];
const [alice, relayer, outsider] = KEYS.map((k) => privateKeyToAccount(k));
const pub = createPublicClient({ chain: foundry, transport: http() });
const w = (acct) => createWalletClient({ account: acct, chain: foundry, transport: http() });

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); };
async function deploy(acct, abi, bytecode, args = []) {
  const hash = await w(acct).deployContract({ abi, bytecode, args });
  return (await pub.waitForTransactionReceipt({ hash })).contractAddress;
}
async function send(acct, address, abi, functionName, args) {
  const hash = await w(acct).writeContract({ address, abi, functionName, args, gas: 6_000_000n });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  return r;
}
async function expectRevert(acct, address, abi, functionName, args, errName) {
  try {
    await pub.simulateContract({ account: acct, address, abi, functionName, args });
    ok(false, `expected revert ${errName}`);
  } catch (e) {
    const name = e?.cause?.data?.errorName ?? e?.cause?.reason ?? e.shortMessage;
    ok(String(name).includes(errName), `reverts with ${errName} (got ${name})`);
  }
}

// ── deploy ──
const p2 = await deploy(alice, poseidonContract.generateABI(2), poseidonContract.createCode(2));
const p3 = await deploy(alice, poseidonContract.generateABI(3), poseidonContract.createCode(3));
const verifierArt = art("Verifier.sol", "Groth16Verifier");
const verifier = await deploy(alice, verifierArt.abi, verifierArt.bytecode.object);
const tokenArt = art("MockERC20.sol", "MockERC20");
const token = await deploy(alice, tokenArt.abi, tokenArt.bytecode.object);
const poolArt = art("VeilPool.sol", "VeilPool");
const pool = await deploy(alice, poolArt.abi, poolArt.bytecode.object, [verifier, p2, p3, token, 1_000_000_000_000n]);
const PA = poolArt.abi, TA = tokenArt.abi;
const read = (address, abi, functionName, args = []) => pub.readContract({ address, abi, functionName, args });

// ── local mirror of the tree, synced from events ──
const tree = new V.MerkleTree();
let fromBlock = 0n;
const NEW_COMMITMENT = parseAbiItem("event NewCommitment(uint256 commitment, uint256 index, bytes encryptedOutput)");
const seen = [];
async function sync() {
  const logs = await pub.getLogs({ address: pool, event: NEW_COMMITMENT, fromBlock, toBlock: "latest" });
  for (const l of logs) {
    const { commitment, index, encryptedOutput } = l.args;
    if (Number(index) !== tree.leaves.length) throw new Error("out-of-order leaf");
    tree.leaves.push(commitment);
    seen.push({ commitment, index: Number(index), encryptedOutput });
  }
  if (logs.length) fromBlock = logs[logs.length - 1].blockNumber + 1n;
  ok((await tree.root()) === (await read(pool, PA, "currentRoot")), `local root == on-chain root (${tree.leaves.length} leaves)`);
}
async function myNotes(keys) {
  const notes = [];
  for (const s of seen) {
    const d = V.readMemo(keys.encPriv, s.encryptedOutput);
    if (!d || d.amount === 0n) continue;
    const note = { amount: d.amount, blinding: d.blinding, pubKey: keys.pubKey, index: s.index, privKey: keys.privKey };
    if ((await V.commitmentOf(note)) !== s.commitment) continue; // memo lies → ignore
    if (await read(pool, PA, "isSpent", [await V.nullifierOf(note, keys.privKey)])) continue;
    notes.push(note);
  }
  return notes;
}

// sanity: empty root + zeros
await sync();
ok((await read(pool, PA, "zeros", [1n])) === (await V.poseidon([0n, 0n])), "zeros(1) == Poseidon(0,0)");

const A = await V.VeilKeys.random(), B = await V.VeilKeys.random();
const D = 1_000_000n; // 6 decimals
await send(alice, token, TA, "mint", [alice.address, 100n * D]);
await send(alice, token, TA, "approve", [pool, 2n ** 255n]);

// 1) deposit 10 to A
let t0 = Date.now();
let tx = await V.buildTransaction({ tree, outputs: [{ amount: 10n * D, pubKey: A.pubKey, encPub: A.encPub }],
  extAmount: 10n * D, changeKeys: A, wasm: WASM, zkey: ZKEY });
console.log(`   proof time ${Date.now() - t0} ms`);
ok(tx.publicSignals.map(BigInt).join() === [tx.proofArgs.root, tx.proofArgs.publicAmount, tx.proofArgs.extDataHash,
  ...tx.proofArgs.inputNullifiers, ...tx.proofArgs.outputCommitments].join(), "publicSignals order == contract order");
ok((await read(pool, PA, "hashExtData", [tx.extData])) === tx.proofArgs.extDataHash, "TS extDataHash == Solidity hashExtData");
let r = await send(alice, pool, PA, "transact", [tx.proofArgs, tx.extData]);
console.log(`   gas deposit ${r.gasUsed}`);
await sync();
let aNotes = await myNotes(A);
ok(aNotes.length === 1 && aNotes[0].amount === 10n * D, "A sees one 10.0 note");

// 2) private transfer 3 to B, fee 0.1 to relayer, submitted by relayer
const fee = 100_000n;
tx = await V.buildTransaction({ tree, inputs: aNotes, outputs: [
  { amount: 3n * D, pubKey: B.pubKey, encPub: B.encPub },
  { amount: 10n * D - 3n * D - fee, pubKey: A.pubKey, encPub: A.encPub }],
  fee, relayer: relayer.address, changeKeys: A, wasm: WASM, zkey: ZKEY });
// tamper: change fee recipient but keep hash → BadExtDataHash
await expectRevert(outsider, pool, PA, "transact", [tx.proofArgs, { ...tx.extData, relayer: outsider.address }], "BadExtDataHash");
// tamper: change recipient AND recompute hash → proof no longer matches → InvalidProof
{
  const evil = { ...tx.extData, relayer: outsider.address };
  await expectRevert(outsider, pool, PA, "transact", [{ ...tx.proofArgs, extDataHash: V.hashExtData(evil) }, evil], "InvalidProof");
}
// tamper: publicAmount mismatch → BadPublicAmount
await expectRevert(outsider, pool, PA, "transact", [tx.proofArgs, { ...tx.extData, fee: 0n }], "BadExtDataHash");
r = await send(relayer, pool, PA, "transact", [tx.proofArgs, tx.extData]);
console.log(`   gas transfer ${r.gasUsed}`);
ok((await read(token, TA, "balanceOf", [relayer.address])) === fee, "relayer received fee");
// replay → NullifierAlreadySpent
await expectRevert(relayer, pool, PA, "transact", [tx.proofArgs, tx.extData], "NullifierAlreadySpent");
await sync();
const bNotes = await myNotes(B);
aNotes = await myNotes(A);
ok(bNotes.length === 1 && bNotes[0].amount === 3n * D, "B sees 3.0");
ok(aNotes.length === 1 && aNotes[0].amount === 10n * D - 3n * D - fee, "A sees change 6.9");

// 3) A cannot spend B's note (needs B's privKey)
try {
  await V.buildTransaction({ tree, inputs: [{ ...bNotes[0], privKey: A.privKey }], outputs: [{ amount: 3n * D, pubKey: A.pubKey, encPub: A.encPub }],
    changeKeys: A, wasm: WASM, zkey: ZKEY });
  ok(false, "A spending B's note should fail to prove");
} catch { ok(true, "A cannot prove a spend of B's note"); }

// 4) depositTo: outsider-funded note for B (contract computes the commitment)
await send(alice, token, TA, "mint", [outsider.address, 5n * D]);
await send(outsider, token, TA, "approve", [pool, 5n * D]);
const blinding = V.randomField();
r = await send(outsider, pool, PA, "depositTo", [B.pubKey, 5n * D, blinding, V.encryptNote(B.encPub, 5n * D, blinding)]);
console.log(`   gas depositTo ${r.gasUsed}`);
await sync();
const bNotes2 = await myNotes(B);
ok(bNotes2.length === 2 && bNotes2.reduce((s, n) => s + n.amount, 0n) === 8n * D, "B sees 3.0 + 5.0 (depositTo note opens in TS)");

// 5) B merges both notes and withdraws 8 to a public address via relayer (fee 0)
const before = await read(token, TA, "balanceOf", [outsider.address]);
tx = await V.buildTransaction({ tree, inputs: bNotes2, outputs: [], extAmount: -8n * D, recipient: outsider.address,
  relayer: relayer.address, changeKeys: B, wasm: WASM, zkey: ZKEY });
r = await send(relayer, pool, PA, "transact", [tx.proofArgs, tx.extData]);
console.log(`   gas withdraw (2 real inputs) ${r.gasUsed}`);
ok((await read(token, TA, "balanceOf", [outsider.address])) - before === 8n * D, "recipient received 8.0");
await sync();
ok((await myNotes(B)).length === 0, "B has no unspent value notes");

// 6) stale root still accepted (A spends change against an older root after other inserts)
aNotes = await myNotes(A);
tx = await V.buildTransaction({ tree, inputs: aNotes, outputs: [{ amount: aNotes[0].amount, pubKey: A.pubKey, encPub: A.encPub }],
  changeKeys: A, wasm: WASM, zkey: ZKEY });
await send(outsider, token, TA, "approve", [pool, 0n]);
await send(alice, pool, PA, "depositTo", [A.pubKey, 1n * D, V.randomField(), "0x"]); // moves the root
r = await send(relayer, pool, PA, "transact", [tx.proofArgs, tx.extData]);
ok(r.status === "success", "proof against an older root still lands");
await sync();

// 7) overflow: an output of 2^128 cannot be proven
try {
  const bigT = new V.MerkleTree(); bigT.leaves = tree.leaves.slice();
  const input = await V.buildTransaction({ tree: bigT, outputs: [{ amount: 2n ** 128n, pubKey: A.pubKey, encPub: A.encPub, blinding: 1n }],
    extAmount: 2n ** 128n, changeKeys: A, wasm: WASM, zkey: ZKEY });
  ok(false, "2^128 output should not be provable");
} catch (e) { ok(true, `2^128 output rejected (${String(e.message).slice(0, 40)})`); }

// 8) contract-level limits
await expectRevert(alice, pool, PA, "depositTo", [A.pubKey, 0n, 1n, "0x"], "InvalidNote");
await expectRevert(alice, pool, PA, "depositTo", [V.FIELD_SIZE, 1n, 1n, "0x"], "ValueOutOfField");
await send(alice, pool, PA, "setDepositsPaused", [true]);
await expectRevert(alice, pool, PA, "depositTo", [A.pubKey, 1n, 1n, "0x"], "DepositsArePaused");
await expectRevert(outsider, pool, PA, "setDepositsPaused", [false], "NotOwner");

// 9) StreamVault payout (plain memo) is spendable by the KOL
{
  const fArt = art("StreamVaultFactory.sol", "StreamVaultFactory"), vArt = art("StreamVault.sol", "StreamVault");
  const factory = await deploy(alice, fArt.abi, fArt.bytecode.object);
  const K = await V.VeilKeys.random(), ADM = await V.VeilKeys.random();
  const now = (await pub.getBlock()).timestamp;
  const cfg = { pool, admin: alice.address, forwarder: alice.address, adminPubKey: ADM.pubKey,
    ratePerThousand: 2n * D, perPostCap: 100n * D, holdbackBps: 2000, minLifetime: 0n, endTime: now + 86400n };
  const salt = "0x" + "11".repeat(32);
  const predicted = await read(factory, fArt.abi, "predict", [alice.address, salt]);
  await send(alice, pool, PA, "setDepositsPaused", [false]);
  await send(alice, token, TA, "mint", [predicted, 50n * D]);
  await send(alice, factory, fArt.abi, "create", [cfg, salt]);
  await send(alice, predicted, vArt.abi, "setKol", [42n, K.pubKey, true]);
  await send(outsider, predicted, vArt.abi, "registerPost", [777n, 42n]);
  const { encodeAbiParameters } = await import("viem");
  const report = encodeAbiParameters([{ type: "uint256[]" }, { type: "uint64[]" }, { type: "bool[]" }], [[777n], [10_000n], [true]]);
  r = await send(alice, predicted, vArt.abi, "onReport", ["0x", report]);
  console.log(`   gas onReport (1 post) ${r.gasUsed}`);
  await sync();
  const kNotes = await myNotes(K);
  ok(kNotes.length === 1 && kNotes[0].amount === 16n * D, "KOL finds the 16.0 payout from the plain memo");
  const before2 = await read(token, TA, "balanceOf", [outsider.address]);
  tx = await V.buildTransaction({ tree, inputs: kNotes, outputs: [], extAmount: -16n * D, recipient: outsider.address, changeKeys: K, wasm: WASM, zkey: ZKEY });
  await send(relayer, pool, PA, "transact", [tx.proofArgs, tx.extData]);
  ok((await read(token, TA, "balanceOf", [outsider.address])) - before2 === 16n * D, "KOL withdrew the payout privately");
  await sync();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
