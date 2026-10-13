import { erc20Abi, toHex } from "viem";
import { randomBytes } from "@noble/hashes/utils";
import { VeilKeys } from "./keys.js";
import { encryptNote } from "./memo.js";
import { selectInputs } from "./coinSelect.js";
import { buildMerge, buildTransfer, buildWithdraw } from "./tx.js";
import { Leaf, OwnedNote, fetchLeavesFromEnvio, fetchLeavesFromRelayer, markSpent, mergeLeaves, scanLeaves, treeFromLeaves } from "./sync.js";

export type VeilPoolConfig = {
    symbol: string;
    address: `0x${string}`;
    token: `0x${string}`;
    decimals: number;
    deployBlock?: number;
};

export type VeilEnv = {
    chainId: number;
    relayerUrl: string;
    envioUrl?: string;
    publicClient: any;
};

export type StatusFn = (msg: string) => void;

const DEPOSIT_TO_ABI = [{
    type: "function", name: "depositTo", stateMutability: "nonpayable",
    inputs: [{ name: "pubKey", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "blinding", type: "uint256" }, { name: "encryptedOutput", type: "bytes" }],
    outputs: [{ name: "commitment", type: "uint256" }, { name: "index", type: "uint32" }],
}] as const;

// keccak256("NewCommitment(uint256,uint256,bytes)")
const NEW_COMMITMENT_TOPIC = "0xe5b9fcee308349a880a3033e7bf8f0d7192658e7dbdaf7481ecc63f3d7addf03";

const randomField = () => BigInt(toHex(randomBytes(31)));

/** Monad charges for the gas *limit*, so pad estimates by 15% only. */
async function padGas(est: Promise<bigint>) {
    return ((await est) * 115n) / 100n;
}

export function serializeRelayRequest(chainId: number, pool: string, proofArgs: any, extData: any) {
    return {
        chainId,
        pool,
        proof: {
            a: proofArgs.a.map(String),
            b: proofArgs.b.map((x: bigint[]) => x.map(String)),
            c: proofArgs.c.map(String),
            root: String(proofArgs.root),
            publicAmount: String(proofArgs.publicAmount),
            extDataHash: String(proofArgs.extDataHash),
            inputNullifiers: proofArgs.inputNullifiers.map(String),
            outputCommitments: proofArgs.outputCommitments.map(String),
        },
        extData: {
            recipient: extData.recipient,
            extAmount: String(extData.extAmount),
            relayer: extData.relayer,
            fee: String(extData.fee),
            encryptedOutput1: extData.encryptedOutput1,
            encryptedOutput2: extData.encryptedOutput2,
        },
    };
}

export async function relayTransaction(relayerUrl: string, chainId: number, pool: string, proofArgs: any, extData: any): Promise<{ txHash: string; commitments: { commitment: string; index: number }[] }> {
    const res = await fetch(`${relayerUrl.replace(/\/$/, "")}/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeRelayRequest(chainId, pool, proofArgs, extData)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `relay failed (${res.status})`);
    return json;
}

export async function relayerStatus(relayerUrl: string, chainId: number): Promise<{ relayer: `0x${string}`; minFee: Record<string, string> }> {
    const res = await fetch(`${relayerUrl.replace(/\/$/, "")}/status`);
    if (!res.ok) throw new Error(`relayer unreachable (${res.status})`);
    const json = await res.json();
    return { relayer: json.relayer, minFee: json.chains?.[String(chainId)]?.minFee ?? {} };
}

/**
 * Everything a wallet needs for one pool: sync, balance, deposit, private send, withdraw.
 * Framework-agnostic: the web app, the MetaMask plugin and the e2e tests all use it.
 */
export class VeilPoolClient {
    leaves: Leaf[] = [];
    notes: OwnedNote[] = [];
    private scannedUpTo = 0;

    constructor(public env: VeilEnv, public pool: VeilPoolConfig, public keys: VeilKeys) {}

    get unspent() {
        return this.notes.filter((n) => !n.spent);
    }

    get balance() {
        return this.unspent.reduce((s, n) => s + n.amount, 0n);
    }

    async fetchNewLeaves(): Promise<Leaf[]> {
        const from = this.leaves.length;
        if (this.env.envioUrl) {
            try {
                return await fetchLeavesFromEnvio(this.env.envioUrl, this.pool.address, from);
            } catch (e) {
                console.warn("[veil] Envio unavailable, falling back to relayer:", (e as Error).message);
            }
        }
        return (await fetchLeavesFromRelayer(this.env.relayerUrl, this.pool.address, from)).leaves;
    }

    /** Poll until the leaf source has caught up to `index` (indexers lag the chain by a block or two). */
    async waitForLeaf(index: number, timeoutMs = 60_000): Promise<void> {
        const start = Date.now();
        for (;;) {
            await this.sync();
            if (this.leaves.length > index) return;
            if (Date.now() - start > timeoutMs) throw new Error("indexer did not catch up; press refresh in a moment");
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    async sync(): Promise<void> {
        const incoming = await this.fetchNewLeaves();
        this.leaves = mergeLeaves(this.leaves, incoming);
        if (this.leaves.length > this.scannedUpTo) {
            const found = await scanLeaves(this.leaves.slice(this.scannedUpTo), this.keys);
            this.notes.push(...found);
            this.scannedUpTo = this.leaves.length;
        }
        this.notes = await markSpent(this.env.publicClient, this.pool.address, this.notes);
    }

    /**
     * Public wallet → private balance. Uses `depositTo`, so no proof is needed:
     * the pool computes the commitment on-chain from (amount, pubKey, blinding).
     */
    async deposit(walletClient: any, amount: bigint, onStatus: StatusFn = () => {}): Promise<string> {
        const account = walletClient.account;
        const pc = this.env.publicClient;
        const allowance: bigint = await pc.readContract({ address: this.pool.token, abi: erc20Abi, functionName: "allowance", args: [account.address, this.pool.address] });
        if (allowance < amount) {
            onStatus(`Approving ${this.pool.symbol}…`);
            const gas = await padGas(pc.estimateContractGas({ account, address: this.pool.token, abi: erc20Abi, functionName: "approve", args: [this.pool.address, amount] }));
            const hash = await walletClient.writeContract({ address: this.pool.token, abi: erc20Abi, functionName: "approve", args: [this.pool.address, amount], gas });
            await pc.waitForTransactionReceipt({ hash });
        }
        onStatus("Shielding into the pool…");
        const blinding = randomField();
        const memo = encryptNote(this.keys.encPub, amount, blinding) as `0x${string}`;
        const args = [this.keys.pubKey, amount, blinding, memo] as const;
        const gas = await padGas(pc.estimateContractGas({ account, address: this.pool.address, abi: DEPOSIT_TO_ABI, functionName: "depositTo", args }));
        const hash = await walletClient.writeContract({ address: this.pool.address, abi: DEPOSIT_TO_ABI, functionName: "depositTo", args, gas });
        const receipt = await pc.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("deposit reverted");
        const log = receipt.logs.find((l: any) => l.address.toLowerCase() === this.pool.address.toLowerCase() && l.topics[0] === NEW_COMMITMENT_TOPIC);
        if (log) {
            onStatus("Waiting for the indexer…");
            await this.waitForLeaf(Number(BigInt("0x" + log.data.slice(66, 130))));
        }
        return hash;
    }

    /** Pick inputs for `target`, merging notes through the relayer when no 1 or 2 notes cover it. */
    private async prepareInputs(target: bigint, relayer: string, prover: any, onStatus: StatusFn): Promise<OwnedNote[]> {
        for (let round = 0; round < 8; round++) {
            if (this.balance < target) throw new Error(`Insufficient private balance (have ${this.balance}, need ${target})`);
            const sel = selectInputs(this.unspent, target);
            if (!sel.needsMerge) return sel.inputs as OwnedNote[];
            onStatus("Combining notes first (one extra private transaction)…");
            const tree = await treeFromLeaves(this.leaves);
            const { proofArgs, extData } = await buildMerge(sel.needsMerge, 0n, relayer, this.keys, tree, prover);
            await relayTransaction(this.env.relayerUrl, this.env.chainId, this.pool.address, proofArgs, extData);
            await this.sync();
        }
        throw new Error("Too many notes to combine; try a smaller amount");
    }

    /** Private balance → any veil: address. Sender, recipient and amount stay hidden. */
    async send(to: string, amount: bigint, prover: any, onStatus: StatusFn = () => {}): Promise<string> {
        onStatus("Syncing pool…");
        await this.sync();
        const { relayer, minFee } = await relayerStatus(this.env.relayerUrl, this.env.chainId);
        const fee = BigInt(minFee[this.pool.address] ?? minFee[this.pool.address.toLowerCase()] ?? 0);
        const inputs = await this.prepareInputs(amount + fee, relayer, prover, onStatus);
        onStatus("Generating zero-knowledge proof on this device…");
        const tree = await treeFromLeaves(this.leaves);
        const { proofArgs, extData } = await buildTransfer(to, amount, fee, relayer, inputs, this.keys, tree, prover);
        onStatus("Relaying private transfer…");
        const res = await relayTransaction(this.env.relayerUrl, this.env.chainId, this.pool.address, proofArgs, extData);
        await this.sync();
        return res.txHash;
    }

    /**
     * Build (but do not relay) a private payment: used by x402, where the *merchant*
     * checks the proof and submits it. Output 0 is always the payment.
     */
    async preparePayment(to: string, amount: bigint, fee: bigint, relayer: string, prover: any, onStatus: StatusFn = () => {}) {
        onStatus("Syncing pool…");
        await this.sync();
        const inputs = await this.prepareInputs(amount + fee, relayer, prover, onStatus);
        onStatus("Generating zero-knowledge proof on this device…");
        const tree = await treeFromLeaves(this.leaves);
        return buildTransfer(to, amount, fee, relayer, inputs, this.keys, tree, prover);
    }

    /** Private balance → public 0x address. */
    async withdraw(recipient: string, amount: bigint, prover: any, onStatus: StatusFn = () => {}): Promise<string> {
        onStatus("Syncing pool…");
        await this.sync();
        const { relayer, minFee } = await relayerStatus(this.env.relayerUrl, this.env.chainId);
        const fee = BigInt(minFee[this.pool.address] ?? minFee[this.pool.address.toLowerCase()] ?? 0);
        const inputs = await this.prepareInputs(amount + fee, relayer, prover, onStatus);
        onStatus("Generating zero-knowledge proof on this device…");
        const tree = await treeFromLeaves(this.leaves);
        const { proofArgs, extData } = await buildWithdraw(recipient, amount, fee, relayer, inputs, this.keys, tree, prover);
        onStatus("Relaying withdrawal…");
        const res = await relayTransaction(this.env.relayerUrl, this.env.chainId, this.pool.address, proofArgs, extData);
        await this.sync();
        return res.txHash;
    }
}
