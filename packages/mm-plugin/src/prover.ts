import fs from "fs";
import path from "path";
import { createProver } from "@veil/sdk/dist/prover.js";

// We assume the circuits are at the root or we can point to apps/web/public/circuits
const CIRCUITS_DIR = path.resolve(__dirname, "../../../../../apps/web/public/circuits");

export async function getNodeProver() {
    const wasmBuf = fs.readFileSync(path.join(CIRCUITS_DIR, "transaction2x2.wasm"));
    const zkeyBuf = fs.readFileSync(path.join(CIRCUITS_DIR, "transaction2x2_final.zkey"));
    
    return createProver(new Uint8Array(wasmBuf), new Uint8Array(zkeyBuf));
}
