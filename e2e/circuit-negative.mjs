// Circuit-level negative tests: bypass the SDK checks and ask the circuit directly.
import * as snarkjs from "snarkjs";
import * as V from "./veil-core.mjs";
const WASM = "../circuits/build/transaction2x2_js/transaction2x2.wasm";
const ZKEY = "../circuits/build/transaction2x2_final.zkey";
const S = (v) => (Array.isArray(v) ? v.map(S) : v.toString());
let pass = 0, fail = 0;
async function expectFail(name, input) {
  try { await snarkjs.groth16.fullProve(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, S(v)])), WASM, ZKEY); fail++; console.log("FAIL ", name, "(proof was produced)"); }
  catch { pass++; console.log("PASS ", name); }
}
async function base({ outAmounts, publicAmount, inNotes, tree }) {
  const k = await V.VeilKeys.random();
  const ins = inNotes ?? [];
  while (ins.length < 2) { const p = V.randomField(); ins.push({ amount: 0n, privKey: p, pubKey: await V.poseidon([p]), blinding: V.randomField(), index: 0 }); }
  const outs = outAmounts.map((a) => ({ amount: a, pubKey: k.pubKey, blinding: V.randomField() }));
  const paths = [];
  for (const n of ins) paths.push(n.amount === 0n ? new Array(20).fill(0n) : (await tree.path(n.index)).pathElements);
  return {
    root: tree ? await tree.root() : (await new V.MerkleTree().root()), publicAmount, extDataHash: 123n,
    inputNullifier: await Promise.all(ins.map((n) => V.nullifierOf(n, n.privKey))),
    outputCommitment: await Promise.all(outs.map((o) => V.commitmentOf(o))),
    inAmount: ins.map((n) => n.amount), inPrivateKey: ins.map((n) => n.privKey), inBlinding: ins.map((n) => n.blinding),
    inPathIndices: ins.map((n) => BigInt(n.index)), inPathElements: paths,
    outAmount: outs.map((o) => o.amount), outPubkey: outs.map((o) => o.pubKey), outBlinding: outs.map((o) => o.blinding),
  };
}
// 1) output of exactly 2^128 with matching publicAmount (balanced, but out of range)
await expectFail("output amount 2^128 rejected by Num2Bits(128)", await base({ outAmounts: [2n ** 128n, 0n], publicAmount: 2n ** 128n }));
// 2) field wrap: outputs [p-1, 1] from a deposit of 0 balances mod p, must be rejected
await expectFail("field-wrap outputs (p-1, 1) rejected", await base({ outAmounts: [V.FIELD_SIZE - 1n, 1n], publicAmount: 0n }));
// 3) unbalanced: deposit 5 but create 6
await expectFail("unbalanced (5 in, 6 out) rejected", await base({ outAmounts: [6n, 0n], publicAmount: 5n }));
// 4) same note used twice as both inputs → identical nullifiers
{
  const k = await V.VeilKeys.random();
  const note = { amount: 7n, pubKey: k.pubKey, blinding: V.randomField(), index: 0, privKey: k.privKey };
  const tree = new V.MerkleTree(); tree.leaves.push(await V.commitmentOf(note));
  await expectFail("double-spend inside one tx (same nullifier twice) rejected",
    await base({ outAmounts: [14n, 0n], publicAmount: 0n, inNotes: [{ ...note }, { ...note }], tree }));
}
// 5) non-zero input that is NOT in the tree
{
  const k = await V.VeilKeys.random();
  const fake = { amount: 50n, pubKey: k.pubKey, blinding: 1n, index: 0, privKey: k.privKey };
  const tree = new V.MerkleTree(); tree.leaves.push(12345n);
  await expectFail("fake input not in tree rejected", await base({ outAmounts: [50n, 0n], publicAmount: 0n, inNotes: [fake], tree }));
}
// 6) positive control: a valid balanced deposit proves
try { await snarkjs.groth16.fullProve(Object.fromEntries(Object.entries(await base({ outAmounts: [5n, 0n], publicAmount: 5n })).map(([k, v]) => [k, S(v)])), WASM, ZKEY); pass++; console.log("PASS  control: valid deposit proves"); }
catch (e) { fail++; console.log("FAIL  control", e.message); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
