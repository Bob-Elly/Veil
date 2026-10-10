import { buildPoseidon } from "circomlibjs";

let _p: any;
export async function poseidon(inputs: bigint[]): Promise<bigint> {
  _p ??= await buildPoseidon();
  return _p.F.toObject(_p(inputs.map((x) => BigInt(x))));
}
