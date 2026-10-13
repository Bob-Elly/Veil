// x402 demo merchant: sells a "quote" for 0.01 USDC, paid privately with the Veil `shielded` scheme.
// Env: RELAYER_URL (default http://localhost:3001), DEPLOYMENTS (default ../../deployments/testnet.json),
//      MERCHANT_SEED (32-byte hex; default fixed demo seed), PORT (default 3002).
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { keccak256, toBytes } = require('viem');
const fs = require('fs');
const path = require('path');
const { VeilKeys, readMemo, formatAddress, poseidon, hashExtData, encodeX402Header, decodeX402Header } = require('@veil/sdk');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = new Hono();
app.use('*', cors({ origin: '*', exposeHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }));

const deployments = JSON.parse(fs.readFileSync(path.resolve(__dirname, process.env.DEPLOYMENTS || '../../deployments/testnet.json'), 'utf8'));
const CHAIN_ID = deployments.chainId;
const POOL = deployments.pools.USDC;
const RELAYER_URL = (process.env.RELAYER_URL || 'http://localhost:3001').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 3002);
const PRICE = 10000n; // 0.01 USDC

const merchantSeed = process.env.MERCHANT_SEED ? toBytes(process.env.MERCHANT_SEED) : new Uint8Array(32).fill(7);
let merchantKeys, merchantVeilAddress, relayerAddress;
const ready = (async () => {
  merchantKeys = await VeilKeys.fromSeed(merchantSeed);
  merchantVeilAddress = formatAddress(merchantKeys);
  const st = await fetch(`${RELAYER_URL}/status`).then((r) => r.json());
  relayerAddress = st.relayer;
  console.log(`merchant ${merchantVeilAddress.slice(0, 24)}…  relayer ${relayerAddress}`);
})();

const seen = new Set();

function requirements(url) {
  return {
    x402Version: 2,
    resource: { url, description: 'One private market quote', mimeType: 'application/json' },
    accepts: [{
      scheme: 'shielded',
      network: `eip155:${CHAIN_ID}`,
      amount: PRICE.toString(),
      asset: POOL.token,
      payTo: merchantVeilAddress,
      maxTimeoutSeconds: 120,
      extra: { pool: POOL.address, relayer: relayerAddress, relayerUrl: RELAYER_URL, fee: '0', version: 'veil-x402-1' },
    }],
  };
}

app.get('/quote', async (c) => {
  await ready;
  const sig = c.req.header('PAYMENT-SIGNATURE');
  if (!sig) {
    c.header('PAYMENT-REQUIRED', encodeX402Header(requirements(c.req.url)));
    return c.json({ error: 'payment_required' }, 402);
  }
  try {
    const id = keccak256(toBytes(sig));
    if (seen.has(id)) return c.json({ error: 'replay' }, 402);
    const { accepted, payload } = decodeX402Header(sig);
    if (accepted.scheme !== 'shielded' || accepted.payTo !== merchantVeilAddress) return c.json({ error: 'invalid_requirements' }, 402);
    const { proof, extData, paymentOutput } = payload;
    if (BigInt(extData.extAmount) !== 0n) return c.json({ error: 'not_a_private_transfer' }, 402);
    if (extData.relayer.toLowerCase() !== relayerAddress.toLowerCase()) return c.json({ error: 'wrong_relayer' }, 402);
    const ext = { ...extData, extAmount: BigInt(extData.extAmount), fee: BigInt(extData.fee) };
    if (hashExtData(ext).toString() !== proof.extDataHash) return c.json({ error: 'bad_ext_data_hash' }, 402);

    // Decrypt our output and check it really commits to >= PRICE for our key.
    const memo = readMemo(merchantKeys.encPriv, paymentOutput === 1 ? extData.encryptedOutput2 : extData.encryptedOutput1);
    if (!memo) return c.json({ error: 'cannot_decrypt_payment' }, 402);
    if (memo.amount < PRICE) return c.json({ error: 'underpaid' }, 402);
    const commitment = await poseidon([memo.amount, merchantKeys.pubKey, memo.blinding]);
    if (commitment.toString() !== proof.outputCommitments[paymentOutput === 1 ? 1 : 0]) return c.json({ error: 'commitment_mismatch' }, 402);

    // Settle: the relayer verifies + submits on-chain.
    seen.add(id);
    const relayRes = await fetch(`${RELAYER_URL}/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId: CHAIN_ID, pool: POOL.address, proof, extData }),
    });
    const relayJson = await relayRes.json();
    if (relayJson.status !== 'success') { seen.delete(id); return c.json({ error: 'settlement_failed: ' + relayJson.error }, 402); }

    c.header('PAYMENT-RESPONSE', encodeX402Header({ success: true, transaction: relayJson.txHash, network: `eip155:${CHAIN_ID}`, payer: '' }));
    const quotes = ['Knowledge is power.', 'Privacy is normal.', 'Ship it.'];
    return c.json({ quote: quotes[Math.floor(Math.random() * quotes.length)], paid: memo.amount.toString(), tx: relayJson.txHash });
  } catch (e) {
    console.error(e);
    return c.json({ error: e.message }, 402);
  }
});

// Stand-in for the X API used by the CRE workflow in local demos.
app.get('/mock-x/tweets/:id', (c) => c.json({
  data: { id: c.req.param('id'), text: 'Loving private payroll on Monad #ad @veil', author_id: '123456789', public_metrics: { impression_count: 50000 } },
}));

serve({ fetch: app.fetch, port: PORT });
console.log(`Demo x402 API listening on port ${PORT}`);
