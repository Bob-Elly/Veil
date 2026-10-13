import * as viem from 'viem';

declare const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
declare const LEVELS = 20;
declare const MAX_NOTE_AMOUNT: bigint;
declare const NETWORKS: any;

declare function poseidon(inputs: bigint[]): Promise<bigint>;

declare class VeilKeys {
    privKey: bigint;
    pubKey: bigint;
    encPriv: Uint8Array;
    encPub: Uint8Array;
    static fromSeed(seed32: Uint8Array): Promise<VeilKeys>;
}
declare function deriveEvmKey(prfOutput: Uint8Array, index: number): Uint8Array;
declare function keysFromPrf(prfOutput: Uint8Array): Promise<{
    publicAccountKey: Uint8Array<ArrayBufferLike>;
    main: VeilKeys;
    auditEnc: VeilKeys;
    atRestKey: Uint8Array<ArrayBufferLike>;
    agent: (k: number) => Promise<VeilKeys>;
    campaignAdmin: (j: number) => Uint8Array<ArrayBufferLike>;
    campaignRefund: (j: number) => Promise<VeilKeys>;
}>;

declare function formatAddress(keys: VeilKeys): string;
declare function parseAddress(addr: string): {
    pubKey: bigint;
    encPub: viem.ByteArray;
};

type Note = {
    amount: bigint;
    pubKey: bigint;
    blinding: bigint;
    index: number;
    privKey?: bigint;
    encPub?: Uint8Array;
};
declare function commitmentOf(note: Note): Promise<bigint>;
declare function nullifierOf(note: Note, privKey: bigint): Promise<bigint>;

declare function encryptNote(encPub: Uint8Array, amount: bigint, blinding: bigint): string;
declare function decryptNote(encPriv: Uint8Array, data: string): {
    amount: bigint;
    blinding: bigint;
} | null;
declare function readMemo(encPriv: Uint8Array, data: string): {
    amount: bigint;
    blinding: bigint;
} | {
    amount: bigint;
    blinding: bigint;
    plain: boolean;
} | null;

declare class MerkleTree {
    leaves: bigint[];
    zeros: bigint[] | null;
    layersCache: bigint[][];
    init(): Promise<void>;
    root(): Promise<bigint>;
    path(index: number): Promise<{
        pathElements: bigint[];
        pathIndices: number;
        root: bigint;
    }>;
    insert(leaf: bigint): Promise<void>;
}

declare const WASM_SHA256 = "574079929F4A81DD1F4DD1E992E3AC602E0203D666189410E414B0A94BCD3166";
declare const ZKEY_SHA256 = "BD33470A44BA4FC2B563F0C6A4CBC6CECF3235CC3D41AD608283821E47C11181";
declare function loadArtifacts(baseUrl: string): Promise<{
    wasm: Uint8Array<ArrayBuffer>;
    zkey: Uint8Array<ArrayBuffer>;
}>;

type ExtData = {
    recipient: string;
    extAmount: bigint;
    relayer: string;
    fee: bigint;
    encryptedOutput1: string;
    encryptedOutput2: string;
};
declare function hashExtData(ext: ExtData): bigint;
declare function publicAmountOf(extAmount: bigint, fee: bigint): bigint;
declare function buildTransaction({ tree, inputs, outputs, extAmount, fee, recipient, relayer, changeKeys, prover }: {
    tree: MerkleTree;
    inputs?: Note[];
    outputs?: Partial<Note>[];
    extAmount?: bigint;
    fee?: bigint;
    recipient?: string;
    relayer?: string;
    changeKeys: VeilKeys;
    prover: (input: any) => Promise<any>;
}): Promise<{
    proofArgs: any;
    extData: ExtData;
    publicSignals: any;
    outputs: {
        amount: bigint;
        blinding: bigint;
        pubKey?: bigint | undefined;
        index?: number | undefined;
        privKey?: bigint | undefined;
        encPub?: Uint8Array | undefined;
    }[];
}>;
declare function buildDeposit(amount: bigint, changeKeys: VeilKeys, tree: MerkleTree, prover: any): Promise<{
    proofArgs: any;
    extData: ExtData;
    publicSignals: any;
    outputs: {
        amount: bigint;
        blinding: bigint;
        pubKey?: bigint | undefined;
        index?: number | undefined;
        privKey?: bigint | undefined;
        encPub?: Uint8Array | undefined;
    }[];
}>;
declare function buildTransfer(toAddr: string, amount: bigint, fee: bigint, relayer: string, inputs: Note[], changeKeys: VeilKeys, tree: MerkleTree, prover: any): Promise<{
    proofArgs: any;
    extData: ExtData;
    publicSignals: any;
    outputs: {
        amount: bigint;
        blinding: bigint;
        pubKey?: bigint | undefined;
        index?: number | undefined;
        privKey?: bigint | undefined;
        encPub?: Uint8Array | undefined;
    }[];
}>;
declare function buildWithdraw(recipient: string, amount: bigint, fee: bigint, relayer: string, inputs: Note[], changeKeys: VeilKeys, tree: MerkleTree, prover: any): Promise<{
    proofArgs: any;
    extData: ExtData;
    publicSignals: any;
    outputs: {
        amount: bigint;
        blinding: bigint;
        pubKey?: bigint | undefined;
        index?: number | undefined;
        privKey?: bigint | undefined;
        encPub?: Uint8Array | undefined;
    }[];
}>;
/** Combine two notes into one (self-transfer). Needed when no 1 or 2 notes cover a payment. */
declare function buildMerge(inputs: Note[], fee: bigint, relayer: string, changeKeys: VeilKeys, tree: MerkleTree, prover: any): Promise<{
    proofArgs: any;
    extData: ExtData;
    publicSignals: any;
    outputs: {
        amount: bigint;
        blinding: bigint;
        pubKey?: bigint | undefined;
        index?: number | undefined;
        privKey?: bigint | undefined;
        encPub?: Uint8Array | undefined;
    }[];
}>;

declare function createProver(wasm: Uint8Array, zkey: Uint8Array): (input: any) => Promise<{
    proofArgs: {
        a: bigint[];
        b: bigint[][];
        c: bigint[];
        root: bigint;
        publicAmount: bigint;
        extDataHash: bigint;
        inputNullifiers: bigint[];
        outputCommitments: bigint[];
    };
    publicSignals: any;
}>;

declare function selectInputs(notes: Note[], target: bigint): {
    inputs: Note[];
    change: bigint;
    needsMerge?: Note[];
};

declare function stringify(obj: any): string;
declare function parse(str: string): any;

/** One NewCommitment event = one leaf of the pool's Merkle tree. */
type Leaf = {
    index: number;
    commitment: bigint;
    memo: string;
    blockNumber?: number;
};
type OwnedNote = Note & {
    commitment: bigint;
    privKey: bigint;
    nullifier: bigint;
    spent: boolean;
};
/** Pull leaves from an Envio HyperIndex GraphQL endpoint, starting at leaf `from`. */
declare function fetchLeavesFromEnvio(envioUrl: string, pool: string, from?: number): Promise<Leaf[]>;
/** Pull leaves from the Veil relayer's RPC-backed cache (`GET /commitments`). */
declare function fetchLeavesFromRelayer(relayerUrl: string, pool: string, from?: number): Promise<{
    leaves: Leaf[];
    synced: boolean;
}>;
/**
 * Leaves must form a gap-free sequence 0..n-1 or the tree root will be wrong.
 * Merges `incoming` into `known` and returns the contiguous prefix.
 */
declare function mergeLeaves(known: Leaf[], incoming: Leaf[]): Leaf[];
declare function treeFromLeaves(leaves: Leaf[]): Promise<MerkleTree>;
/**
 * Trial-decrypt every memo with our view key. A note only counts as ours if the
 * commitment recomputed from (amount, ourPubKey, blinding) equals the on-chain leaf,
 * so a forged memo can never show a fake balance.
 */
declare function scanLeaves(leaves: Leaf[], keys: VeilKeys): Promise<OwnedNote[]>;
/** Ask the pool which of our notes are already spent (no nullifier indexing needed). */
declare function markSpent(publicClient: any, pool: string, notes: OwnedNote[]): Promise<OwnedNote[]>;
/** Back-compat alias. */
declare function syncFromEnvio(url: string, pool: string, from?: number): Promise<Leaf[]>;

interface NoteStore {
    addNote(note: Note): Promise<void>;
    removeNote(nullifier: bigint): Promise<void>;
    getNotes(): Promise<Note[]>;
    clear(): Promise<void>;
}
declare class MemoryNoteStore implements NoteStore {
    private notes;
    addNote(note: Note): Promise<void>;
    removeNote(nullifier: bigint): Promise<void>;
    getNotes(): Promise<Note[]>;
    clear(): Promise<void>;
}

declare class Wallet {
    keys: VeilKeys;
    store: NoteStore;
    constructor(keys: VeilKeys, store: NoteStore);
    balance(): Promise<bigint>;
    spendable(): Promise<Note[]>;
}

declare function submitDirect(walletClient: any, contractAddress: string, txArgs: any): Promise<void>;
declare function submitViaRelayer(relayerUrl: string, txArgs: any): Promise<void>;

declare const disclose: {};

/**
 * Veil x402 "shielded" scheme (x402 v2 headers: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE,
 * each base64(JSON)). The payer proves a private transfer to the merchant's veil: address; the merchant
 * decrypts output 0, checks the commitment and amount, then relays the proof.
 */
declare const X402_SCHEME = "shielded";
declare const encodeX402Header: (obj: unknown) => string;
declare const decodeX402Header: <T = any>(h: string) => T;
declare function buildPaymentSignature(accepted: any, chainId: number, proofArgs: any, extData: any): string;

declare const payroll: {};

type VeilPoolConfig = {
    symbol: string;
    address: `0x${string}`;
    token: `0x${string}`;
    decimals: number;
    deployBlock?: number;
};
type VeilEnv = {
    chainId: number;
    relayerUrl: string;
    envioUrl?: string;
    publicClient: any;
};
type StatusFn = (msg: string) => void;
declare function serializeRelayRequest(chainId: number, pool: string, proofArgs: any, extData: any): {
    chainId: number;
    pool: string;
    proof: {
        a: any;
        b: any;
        c: any;
        root: string;
        publicAmount: string;
        extDataHash: string;
        inputNullifiers: any;
        outputCommitments: any;
    };
    extData: {
        recipient: any;
        extAmount: string;
        relayer: any;
        fee: string;
        encryptedOutput1: any;
        encryptedOutput2: any;
    };
};
declare function relayTransaction(relayerUrl: string, chainId: number, pool: string, proofArgs: any, extData: any): Promise<{
    txHash: string;
    commitments: {
        commitment: string;
        index: number;
    }[];
}>;
declare function relayerStatus(relayerUrl: string, chainId: number): Promise<{
    relayer: `0x${string}`;
    minFee: Record<string, string>;
}>;
/**
 * Everything a wallet needs for one pool: sync, balance, deposit, private send, withdraw.
 * Framework-agnostic: the web app, the MetaMask plugin and the e2e tests all use it.
 */
declare class VeilPoolClient {
    env: VeilEnv;
    pool: VeilPoolConfig;
    keys: VeilKeys;
    leaves: Leaf[];
    notes: OwnedNote[];
    private scannedUpTo;
    constructor(env: VeilEnv, pool: VeilPoolConfig, keys: VeilKeys);
    get unspent(): OwnedNote[];
    get balance(): bigint;
    fetchNewLeaves(): Promise<Leaf[]>;
    /** Poll until the leaf source has caught up to `index` (indexers lag the chain by a block or two). */
    waitForLeaf(index: number, timeoutMs?: number): Promise<void>;
    sync(): Promise<void>;
    /**
     * Public wallet → private balance. Uses `depositTo`, so no proof is needed:
     * the pool computes the commitment on-chain from (amount, pubKey, blinding).
     */
    deposit(walletClient: any, amount: bigint, onStatus?: StatusFn): Promise<string>;
    /** Pick inputs for `target`, merging notes through the relayer when no 1 or 2 notes cover it. */
    private prepareInputs;
    /** Private balance → any veil: address. Sender, recipient and amount stay hidden. */
    send(to: string, amount: bigint, prover: any, onStatus?: StatusFn): Promise<string>;
    /**
     * Build (but do not relay) a private payment: used by x402, where the *merchant*
     * checks the proof and submits it. Output 0 is always the payment.
     */
    preparePayment(to: string, amount: bigint, fee: bigint, relayer: string, prover: any, onStatus?: StatusFn): Promise<{
        proofArgs: any;
        extData: ExtData;
        publicSignals: any;
        outputs: {
            amount: bigint;
            blinding: bigint;
            pubKey?: bigint | undefined;
            index?: number | undefined;
            privKey?: bigint | undefined;
            encPub?: Uint8Array | undefined;
        }[];
    }>;
    /** Private balance → public 0x address. */
    withdraw(recipient: string, amount: bigint, prover: any, onStatus?: StatusFn): Promise<string>;
}

export { type ExtData, FIELD_SIZE, LEVELS, type Leaf, MAX_NOTE_AMOUNT, MemoryNoteStore, MerkleTree, NETWORKS, type Note, type NoteStore, type OwnedNote, type StatusFn, type VeilEnv, VeilKeys, VeilPoolClient, type VeilPoolConfig, WASM_SHA256, Wallet, X402_SCHEME, ZKEY_SHA256, buildDeposit, buildMerge, buildPaymentSignature, buildTransaction, buildTransfer, buildWithdraw, commitmentOf, createProver, decodeX402Header, decryptNote, deriveEvmKey, disclose, encodeX402Header, encryptNote, fetchLeavesFromEnvio, fetchLeavesFromRelayer, formatAddress, hashExtData, keysFromPrf, loadArtifacts, markSpent, mergeLeaves, nullifierOf, parse, parseAddress, payroll, poseidon, publicAmountOf, readMemo, relayTransaction, relayerStatus, scanLeaves, selectInputs, serializeRelayRequest, stringify, submitDirect, submitViaRelayer, syncFromEnvio, treeFromLeaves };
