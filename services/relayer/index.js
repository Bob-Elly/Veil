const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { createPublicClient, createWalletClient, http, parseAbiItem, keccak256, encodeAbiParameters, parseAbiParameters, recoverMessageAddress, decodeEventLog } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet } = require('viem/chains');
require('dotenv').config();

const app = new Hono();
app.use('*', cors());

const chainId = 10143;
const relayerPk = process.env.RELAYER_PK;
if (!relayerPk) throw new Error("RELAYER_PK is not set");

const account = privateKeyToAccount(relayerPk);
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz/')
});
const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz/')
});

const deployments = require('../../deployments/testnet.json');

const transactAbi = [
  "function transact((uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 publicAmount, uint256 extDataHash, uint256[2] inputNullifiers, uint256[2] outputCommitments) proof, (address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2) extData) external"
];
const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function hashExtData(extData) {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address recipient, int256 extAmount, address relayer, uint256 fee, bytes encryptedOutput1, bytes encryptedOutput2'),
    [extData.recipient, BigInt(extData.extAmount), extData.relayer, BigInt(extData.fee), extData.encryptedOutput1, extData.encryptedOutput2]
  );
  const hash = BigInt(keccak256(encoded));
  return (hash % p).toString();
}

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
        a: proof.a, b: proof.b, c: proof.c,
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
        abi: parseAbiItem(transactAbi[0]),
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
      abi: parseAbiItem(transactAbi[0]),
      functionName: 'transact',
      args,
      account
    });
    
    const gas = (gasEstimate * 115n) / 100n;

    const txHash = await walletClient.writeContract({
      address: pool,
      abi: parseAbiItem(transactAbi[0]),
      functionName: 'transact',
      args,
      account,
      gas
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
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
      "10143": {
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

const port = 3001;
serve({
  fetch: app.fetch,
  port
});
console.log(`Relayer listening on port ${port}`);
