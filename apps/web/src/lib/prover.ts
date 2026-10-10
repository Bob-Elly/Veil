import { createProver } from "@veil/sdk/dist/prover";

let proverInstance: any = null;

export async function getProver() {
    if (proverInstance) return proverInstance;

    // Load circuits from the public folder
    const wasmRes = await fetch("/circuits/transaction2x2.wasm");
    const wasmBuf = await wasmRes.arrayBuffer();

    const zkeyRes = await fetch("/circuits/transaction2x2_final.zkey");
    const zkeyBuf = await zkeyRes.arrayBuffer();

    proverInstance = createProver(new Uint8Array(wasmBuf), new Uint8Array(zkeyBuf));
    return proverInstance;
}
