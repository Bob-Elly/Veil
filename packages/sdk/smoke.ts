import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { readFileSync } from "fs";
import { VeilKeys, keysFromPrf } from "./src/keys.js";
import { MerkleTree } from "./src/tree.js";
import { buildDeposit, buildTransfer, buildWithdraw } from "./src/tx.js";
import { submitDirect } from "./src/submit.js";
import { NETWORKS } from "./src/constants.js";
import { parseAddress, formatAddress } from "./src/address.js";
import { createProver } from "./src/prover.js";
import { randomBytes } from "crypto";

const OUT = "../../deployments/testnet.json";

async function main() {
    console.log("==> Starting Testnet Smoke Test");
    
    // Load deployment addresses
    const deployments = JSON.parse(readFileSync(OUT, "utf8"));
    const poolAddress = deployments.pools.AUSD.address;
    const ausdAddress = deployments.pools.AUSD.token;
    
    console.log("Pool:", poolAddress);
    console.log("AUSD:", ausdAddress);

    const pk = process.env.DEPLOYER_PK || "0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50";
    const account = privateKeyToAccount(pk as `0x${string}`);
    const pub = createPublicClient({ chain: monadTestnet, transport: http() });
    const w = createWalletClient({ account, chain: monadTestnet, transport: http() });

    const PA = JSON.parse(readFileSync("../../contracts/out/VeilPool.sol/VeilPool.json", "utf8")).abi;
    const TA = JSON.parse(readFileSync("../../contracts/out/MockERC20.sol/MockERC20.json", "utf8")).abi;

    // 1. Setup keys
    const keysA = await VeilKeys.fromSeed(new Uint8Array(randomBytes(32)));
    const keysB = await VeilKeys.fromSeed(new Uint8Array(randomBytes(32)));
    const tree = new MerkleTree();
    const WASM = "../../circuits/build/transaction2x2_js/transaction2x2.wasm";
    const ZKEY = "../../circuits/build/transaction2x2_final.zkey";
    
    const wasmBuf = new Uint8Array(readFileSync(WASM));
    const zkeyBuf = new Uint8Array(readFileSync(ZKEY));
    const prover = createProver(wasmBuf, zkeyBuf);

    const amount = 1_000_000n; // 1 USDC

    // 2. Mint/Approve Token
    console.log("Minting AUSD...");
    const hashMint = await w.writeContract({ address: ausdAddress as `0x${string}`, abi: TA, functionName: "mint", args: [account.address, amount * 100n] });
    await pub.waitForTransactionReceipt({ hash: hashMint });

    console.log("Approving AUSD...");
    const hashApprove = await w.writeContract({ address: ausdAddress as `0x${string}`, abi: TA, functionName: "approve", args: [poolAddress, amount] });
    await pub.waitForTransactionReceipt({ hash: hashApprove });
    
    // 3. Deposit to A
    console.log("Depositing to A...");
    const depositTx = await buildDeposit(amount, keysA, tree, prover);
    
    const hashDeposit = await w.writeContract({ address: poolAddress as `0x${string}`, abi: PA, functionName: "transact", args: [depositTx.proofArgs, depositTx.extData], gas: 6000000n });
    const rcptDep = await pub.waitForTransactionReceipt({ hash: hashDeposit });
    console.log("Deposit successful:", rcptDep.transactionHash);

    // Sync tree (stub for smoke)
    await tree.insert(depositTx.proofArgs.outputCommitments[0]);
    await tree.insert(depositTx.proofArgs.outputCommitments[1]);

    // 4. Transfer A to B
    console.log("Transferring A to B...");
    const aNote = { amount, pubKey: keysA.pubKey, blinding: depositTx.outputs[0].blinding, index: 0, privKey: keysA.privKey };
    
    const transferTx = await buildTransfer(formatAddress(keysB), amount - 1000n, 1000n, account.address, [aNote], keysA, tree, prover);

    const hashTransfer = await w.writeContract({ address: poolAddress as `0x${string}`, abi: PA, functionName: "transact", args: [transferTx.proofArgs, transferTx.extData], gas: 6000000n });
    const rcptTransfer = await pub.waitForTransactionReceipt({ hash: hashTransfer });
    console.log("Transfer successful:", rcptTransfer.transactionHash);

    // Sync tree
    await tree.insert(transferTx.proofArgs.outputCommitments[0]);
    await tree.insert(transferTx.proofArgs.outputCommitments[1]);

    // 5. Withdraw from B
    console.log("Withdrawing from B...");
    const bNote = { amount: amount - 1000n, pubKey: keysB.pubKey, blinding: transferTx.outputs[0].blinding, index: 2, privKey: keysB.privKey };
    
    const withdrawTx = await buildWithdraw(account.address, amount - 1000n, 0n, account.address, [bNote], keysB, tree, prover);

    const hashWithdraw = await w.writeContract({ address: poolAddress as `0x${string}`, abi: PA, functionName: "transact", args: [withdrawTx.proofArgs, withdrawTx.extData], gas: 6000000n });
    const rcptWithdraw = await pub.waitForTransactionReceipt({ hash: hashWithdraw });
    console.log("Withdraw successful:", rcptWithdraw.transactionHash);
    
    console.log("==> Testnet Smoke Test Complete!");
}

main().catch(console.error);
