const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { parseAbiParameters, encodeAbiParameters, keccak256 } = require('viem');
const { VeilKeys, readMemo, formatAddress } = require('@veil/sdk');

const app = new Hono();
app.use('*', cors());

const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Dummy merchant key
const merchantSeed = new Uint8Array(32).fill(7);
let merchantKeys, merchantVeilAddress;
VeilKeys.fromSeed(merchantSeed).then(k => {
  merchantKeys = k;
  merchantVeilAddress = formatAddress(k);
});
const merchantEoa = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";

const USDC_TOKEN = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const USDC_POOL = "0x57c2502f0522d2128f72ea867d2225fb15aeb1d1"; // Hardcoding for simplicity
const RELAYER = "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";
const RELAYER_URL = "http://localhost:3001/relay";

const seenHeaders = new Set();

function hashExtData(extData) {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2'),
    [extData.recipient, BigInt(extData.extAmount), extData.relayer, BigInt(extData.fee), extData.encryptedOutput1, extData.encryptedOutput2]
  );
  const hash = BigInt(keccak256(encoded));
  return (hash % p).toString();
}

app.get('/quote', async (c) => {
  const sig = c.req.header('PAYMENT-SIGNATURE');
  
  const accepts = [
    {
      scheme: "shielded",
      network: "eip155:10143",
      amount: "10000",
      asset: USDC_TOKEN,
      payTo: merchantVeilAddress,
      maxTimeoutSeconds: 60,
      extra: { pool: USDC_POOL, relayer: RELAYER, relayerUrl: RELAYER_URL, fee: "0", version: "veil-x402-1" }
    },
    {
      scheme: "exact",
      network: "eip155:10143",
      amount: "10000",
      asset: USDC_TOKEN,
      payTo: merchantEoa,
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" }
    }
  ];

  if (!sig) {
    const requirement = {
      x402Version: 2,
      resource: { url: "http://localhost:3002/quote", description: "1 quote" },
      accepts
    };
    c.header('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(requirement)).toString('base64'));
    return c.json({ error: "Payment required" }, 402);
  }

  // Handle PAYMENT-SIGNATURE
  try {
    const headerStr = Buffer.from(sig, 'base64').toString('utf-8');
    const headerHash = keccak256(Buffer.from(headerStr));
    if (seenHeaders.has(headerHash)) {
      return c.json({ error: "replay" }, 402);
    }

    const payload = JSON.parse(headerStr);
    
    // Check acceptance
    if (payload.accepted.scheme !== "shielded") return c.json({ error: "invalid_requirements" }, 402);
    
    const { proof, extData, paymentOutput } = payload.payload;
    if (BigInt(extData.extAmount) !== 0n) return c.json({ error: "extAmount not 0" }, 402);
    if (extData.recipient.toLowerCase() !== "0x0000000000000000000000000000000000000000") return c.json({ error: "recipient not 0x0" }, 402);
    if (extData.relayer.toLowerCase() !== RELAYER.toLowerCase()) return c.json({ error: "wrong relayer" }, 402);
    
    if (hashExtData(extData) !== proof.extDataHash) return c.json({ error: "bad extDataHash" }, 402);

    const encMemo = paymentOutput === 0 ? extData.encryptedOutput1 : extData.encryptedOutput2;
    const memo = readMemo(merchantKeys.encPriv, Buffer.from(encMemo.slice(2), 'hex'));
    if (!memo) return c.json({ error: "cannot decrypt memo" }, 402);

    if (memo.amount < BigInt(payload.accepted.amount)) return c.json({ error: "underpaid" }, 402);

    // Build the commitment to check it matches proof
    const { poseidon } = require('@veil/sdk');
    const commitment = await poseidon([memo.amount, BigInt(merchantKeys.main.pubKey), memo.blinding]);
    if (commitment.toString() !== proof.outputCommitments[paymentOutput]) return c.json({ error: "commitment mismatch" }, 402);

    // Post to relayer
    const relayRes = await fetch(RELAYER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId: 10143, pool: USDC_POOL, proof, extData })
    });
    const relayJson = await relayRes.json();
    if (relayJson.status !== 'success') {
      return c.json({ error: "relay failed: " + relayJson.error }, 402);
    }

    seenHeaders.add(headerHash);
    c.header('PAYMENT-RESPONSE', Buffer.from(JSON.stringify({ success: true, transaction: relayJson.txHash, network: "eip155:10143", payer: "" })).toString('base64'));
    return c.json({ quote: "Knowledge is power." });
  } catch(e) {
    console.error(e);
    return c.json({ error: e.message }, 402);
  }
});
app.get('/mock-x/tweets/:id', (c) => {
  const id = c.req.param('id');
  const xUserId = "123456789"; // mock user id
  return c.json({
    data: {
      id,
      text: "This is a great product! #ad @veil",
      author_id: xUserId,
      public_metrics: {
        impression_count: 50000
      }
    }
  });
});

const port = 3002;
serve({
  fetch: app.fetch,
  port
});
console.log(`Demo API listening on port ${port}`);
