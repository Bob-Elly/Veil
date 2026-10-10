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

declare function syncFromEnvio(url: string, lastBlock: number): Promise<never[]>;
declare function syncFromRpc(publicClient: any, contractAddress: string, lastBlock: number): Promise<never[]>;

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

declare const x402: {};

declare const payroll: {};

export { type ExtData, FIELD_SIZE, LEVELS, MAX_NOTE_AMOUNT, MemoryNoteStore, MerkleTree, NETWORKS, type Note, type NoteStore, VeilKeys, WASM_SHA256, Wallet, ZKEY_SHA256, buildDeposit, buildTransaction, buildTransfer, buildWithdraw, commitmentOf, createProver, decryptNote, deriveEvmKey, disclose, encryptNote, formatAddress, hashExtData, keysFromPrf, loadArtifacts, nullifierOf, parse, parseAddress, payroll, poseidon, publicAmountOf, readMemo, selectInputs, stringify, submitDirect, submitViaRelayer, syncFromEnvio, syncFromRpc, x402 };
