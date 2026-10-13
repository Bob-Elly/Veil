const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { createPublicClient, createWalletClient, http, parseAbiItem, keccak256, encodeAbiParameters, parseAbiParameters, recoverMessageAddress, decodeEventLog, toEventSelector } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet, foundry } = require('viem/chains');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = new Hono();
app.use('*', cors());

// Config (env): RELAYER_PK, RPC_URL, DEPLOYMENTS (path to deployments json), PORT, LOG_RANGE, SCAN_CONCURRENCY
const deployments = JSON.parse(fs.readFileSync(path.resolve(__dirname, process.env.DEPLOYMENTS || '../../deployments/testnet.json'), 'utf8'));
const chainId = deployments.chainId;
const chain = chainId === 31337 ? foundry : monadTestnet;
const rpcUrl = process.env.RPC_URL || process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz/';
const relayerPk = process.env.RELAYER_PK;
if (!relayerPk) throw new Error("RELAYER_PK is not set");

const account = privateKeyToAccount(relayerPk.startsWith('0x') ? relayerPk : `0x${relayerPk}`);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

const transactAbi = [
  "function transact((uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 publicAmount, uint256 extDataHash, uint256[2] inputNullifiers, uint256[2] outputCommitments) proof, (address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2) extData) external"
];
const TRANSACT_ABI = [parseAbiItem(transactAbi[0])];
const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function hashExtData(extData) {
  // Must match VeilPool.hashExtData: keccak256(abi.encode(ExtData struct)) % p, i.e. *tuple* encoding.
  const encoded = encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'recipient', type: 'address' }, { name: 'extAmount', type: 'int256' }, { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' }, { name: 'encryptedOutput1', type: 'bytes' }, { name: 'encryptedOutput2', type: 'bytes' },
    ] }],
    [{ recipient: extData.recipient, extAmount: BigInt(extData.extAmount), relayer: extData.relayer, fee: BigInt(extData.fee), encryptedOutput1: extData.encryptedOutput1, encryptedOutput2: extData.encryptedOutput2 }]
  );
  return (BigInt(keccak256(encoded)) % p).toString();
}


// ───────────── commitment cache ─────────────
// Monad's public RPC caps eth_getLogs at 100 blocks, so wallets can't rebuild the tree
// themselves. The relayer scans each pool once (in parallel chunks), keeps every
// NewCommitment in memory + on disk, and serves them at GET /commitments.
// Envio (indexer/) is the preferred source; this is the zero-setup fallback.
const NEW_COMMITMENT = parseAbiItem("event NewCommitment(uint256 commitment, uint256 index, bytes encryptedOutput)");
const NEW_COMMITMENT_TOPIC = toEventSelector(NEW_COMMITMENT);
const LOG_RANGE = BigInt(process.env.LOG_RANGE || 100);
const SCAN_CONCURRENCY = Number(process.env.SCAN_CONCURRENCY || 8);
const CACHE_DIR = path.join(__dirname, '.cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const caches = {}; // pool(lowercase) -> { leaves: Map<index, leaf>, nextBlock: bigint, head: bigint, synced: bool }

function cacheFile(pool) { return path.join(CACHE_DIR, `${chainId}-${pool}.json`); }

function loadCache(pool, deployBlock) {
  try {
    const j = JSON.parse(fs.readFileSync(cacheFile(pool), 'utf8'));
    return { leaves: new Map(j.leaves.map((l) => [l.index, l])), nextBlock: BigInt(j.nextBlock), head: 0n, synced: false };
  } catch {
    return { leaves: new Map(), nextBlock: BigInt(deployBlock || 0), head: 0n, synced: false };
  }
}

function saveCache(pool) {
  const c = caches[pool];
  const leaves = [...c.leaves.values()].sort((a, b) => a.index - b.index);
  fs.writeFileSync(cacheFile(pool), JSON.stringify({ nextBlock: c.nextBlock.toString(), leaves }));
}

function addLogs(pool, logs) {
  const c = caches[pool];
  for (const log of logs) {
    const { args } = decodeEventLog({ abi: [NEW_COMMITMENT], data: log.data, topics: log.topics });
    const index = Number(args.index);
    c.leaves.set(index, { index, commitment: args.commitment.toString(), memo: args.encryptedOutput, blockNumber: Number(log.blockNumber), txHash: log.transactionHash });
  }
}

async function getLogsRetry(address, fromBlock, toBlock) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await publicClient.getLogs({ address, event: NEW_COMMITMENT, fromBlock, toBlock });
    } catch (e) {
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

async function scanPool(pool) {
  const c = caches[pool];
  const head = await publicClient.getBlockNumber();
  c.head = head;
  while (c.nextBlock <= head) {
    const ranges = [];
    let from = c.nextBlock;
    for (let i = 0; i < SCAN_CONCURRENCY * 4 && from <= head; i++) {
      const to = from + LOG_RANGE - 1n > head ? head : from + LOG_RANGE - 1n;
      ranges.push([from, to]);
      from = to + 1n;
    }
    for (let i = 0; i < ranges.length; i += SCAN_CONCURRENCY) {
      const batch = ranges.slice(i, i + SCAN_CONCURRENCY);
      const results = await Promise.all(batch.map(([f, t]) => getLogsRetry(pool, f, t)));
      results.forEach((logs) => addLogs(pool, logs));
    }
    c.nextBlock = from;
    if (!c.synced) {
      const total = Number(head - BigInt(deployments.pools ? Object.values(deployments.pools).find((p) => p.address.toLowerCase() === pool)?.deployBlock || 0 : 0));
      const left = Number(head - c.nextBlock);
      if (total > 0) process.stdout.write(`\r[scan] ${pool.slice(0, 10)}… ${Math.min(100, Math.max(0, Math.round(100 - (left / total) * 100)))}% (${c.leaves.size} leaves)   `);
    }
  }
  if (!c.synced) { c.synced = true; console.log(`\n[scan] ${pool} synced at block ${head}: ${c.leaves.size} leaves`); }
  saveCache(pool);
}

async function scanLoop() {
  for (const p of Object.values(deployments.pools)) {
    const pool = p.address.toLowerCase();
    caches[pool] = loadCache(pool, p.deployBlock);
  }
  for (;;) {
    for (const pool of Object.keys(caches)) {
      try { await scanPool(pool); } catch (e) { console.error(`[scan] ${pool}:`, e.shortMessage || e.message); }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
scanLoop();

app.get('/commitments', (c) => {
  const pool = (c.req.query('pool') || '').toLowerCase();
  const from = Number(c.req.query('from') || 0);
  const cache = caches[pool];
  if (!cache) return c.json({ error: 'unknown_pool' }, 400);
  const out = [];
  for (let i = from; cache.leaves.has(i) && out.length < 5000; i++) out.push(cache.leaves.get(i));
  return c.json({ commitments: out, synced: cache.synced, total: cache.leaves.size, scannedTo: (cache.nextBlock - 1n).toString() });
});

app.post('/relay', async (c) => {
  try {
    const body = await c.req.json();
    const { chainId: reqChainId, pool, proof, extData } = body;

    if (reqChainId !== chainId) return c.json({ error: 'unknown_pool' }, 400);
    
    let isKnownPool = false;
    for (const p of Object.values(deployments.pools)) {
      if (p.address.toLowerCase() === pool.toLowerCase()) {
        isKnownPool = true;
        break;
      }
    }
    if (!isKnownPool) return c.json({ error: 'unknown_pool' }, 400);

    if (BigInt(extData.extAmount) > 0n) return c.json({ error: 'deposit_not_relayed' }, 400);
    if (extData.relayer.toLowerCase() !== account.address.toLowerCase()) return c.json({ error: 'wrong_relayer' }, 400);
    if (BigInt(extData.fee) < 0n) return c.json({ error: 'fee_too_low' }, 400);

    const recomputedHash = hashExtData(extData);
    if (recomputedHash !== proof.extDataHash) return c.json({ error: 'bad_ext_data' }, 400);

    // Prepare arguments
    const args = [
      {
        a: proof.a.map(BigInt), b: proof.b.map((r) => r.map(BigInt)), c: proof.c.map(BigInt),
        root: BigInt(proof.root),
        publicAmount: BigInt(proof.publicAmount),
        extDataHash: BigInt(proof.extDataHash),
        inputNullifiers: proof.inputNullifiers.map(BigInt),
        outputCommitments: proof.outputCommitments.map(BigInt)
      },
      {
        recipient: extData.recipient,
        extAmount: BigInt(extData.extAmount),
        relayer: extData.relayer,
        fee: BigInt(extData.fee),
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2
      }
    ];

    try {
      await publicClient.simulateContract({
        address: pool,
        abi: TRANSACT_ABI,
        functionName: 'transact',
        args,
        account
      });
    } catch (e) {
      console.error("Simulation error", e.message);
      return c.json({ error: e.shortMessage || e.message }, 400);
    }

    const gasEstimate = await publicClient.estimateContractGas({
      address: pool,
      abi: TRANSACT_ABI,
      functionName: 'transact',
      args,
      account
    });
    
    const gas = (gasEstimate * 115n) / 100n;

    const txHash = await walletClient.writeContract({
      address: pool,
      abi: TRANSACT_ABI,
      functionName: 'transact',
      args,
      account,
      gas
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') return c.json({ error: 'transaction reverted', txHash }, 500);
    const poolKey = pool.toLowerCase();
    if (caches[poolKey]) addLogs(poolKey, receipt.logs.filter((l) => l.address.toLowerCase() === poolKey && l.topics[0] === NEW_COMMITMENT_TOPIC));
    
    const commitments = [];
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [parseAbiItem("event NewCommitment(uint256 commitment, uint256 index, bytes encryptedOutput)")],
          data: log.data,
          topics: log.topics
        });
        if (decoded.eventName === 'NewCommitment') {
          commitments.push({
            commitment: decoded.args.commitment.toString(),
            index: Number(decoded.args.index)
          });
        }
      } catch (e) {
        // ignore other logs
      }
    }

    return c.json({ status: "success", txHash, commitments });
  } catch(e) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  }
});

app.get('/status', async (c) => {
  const bal = await publicClient.getBalance({ address: account.address });
  return c.json({
    relayer: account.address,
    chains: {
      [String(chainId)]: {
        balanceMon: bal.toString(),
        minFee: Object.fromEntries(Object.values(deployments.pools).map(p => [p.address, "0"])),
        pools: Object.values(deployments.pools).map(p => p.address)
      }
    }
  });
});

const dripUsed = new Set();
app.post('/gas-drip', async (c) => {
  try {
    const { address, chainId: dripChainId, signature } = await c.req.json();
    if (dripChainId !== chainId) return c.json({ error: "wrong_chain" }, 400);
    
    const msg = `veil-gas-drip:${address}:${dripChainId}`;
    const recovered = await recoverMessageAddress({ message: msg, signature });
    if (recovered.toLowerCase() !== address.toLowerCase()) return c.json({ error: "bad_signature" }, 400);
    
    if (dripUsed.has(address.toLowerCase())) return c.json({ error: "already_dripped" }, 400);

    const bal = await publicClient.getBalance({ address });
    if (bal >= 10000000000000000n) { // 0.01 MON
      return c.json({ error: "balance_too_high" }, 400);
    }

    const tx = await walletClient.sendTransaction({
      to: address,
      value: 50000000000000000n // 0.05 MON
    });
    
    dripUsed.add(address.toLowerCase());
    return c.json({ status: "success", txHash: tx });
  } catch(e) {
    return c.json({ error: e.message }, 500);
  }
});

const port = Number(process.env.PORT || 3001);
serve({
  fetch: app.fetch,
  port
});
console.log(`Relayer listening on port ${port}`);
