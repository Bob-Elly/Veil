const { VeilKeys, formatAddress } = require('@veil/sdk');
async function run() {
  const merchantSeed = new Uint8Array(32).fill(7);
  const k = await VeilKeys.fromSeed(merchantSeed);
  console.log("k:", k);
  console.log("pubKey:", typeof k.pubKey, k.pubKey);
  console.log("address:", formatAddress(k));
}
run().catch(console.error);
