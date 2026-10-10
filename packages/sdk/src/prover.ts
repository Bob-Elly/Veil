import * as snarkjs from "snarkjs";

const stringify = (v: any): any => (Array.isArray(v) ? v.map(stringify) : v.toString());

export function createProver(wasm: Uint8Array, zkey: Uint8Array) {
    return async (input: any) => {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            Object.fromEntries(Object.entries(input).map(([k, v]) => [k, stringify(v)])),
            wasm,
            zkey
        );

        const proofArgs = {
            a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
            b: [[BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]],
            c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
            root: BigInt(publicSignals[0]),
            publicAmount: BigInt(publicSignals[1]),
            extDataHash: BigInt(publicSignals[2]),
            inputNullifiers: [BigInt(publicSignals[3]), BigInt(publicSignals[4])],
            outputCommitments: [BigInt(publicSignals[5]), BigInt(publicSignals[6])],
        };
        return { proofArgs, publicSignals };
    };
}
