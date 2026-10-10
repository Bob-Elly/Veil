// Writes circomlibjs Poseidon bytecode for Forge tests and deployment scripts.
import { writeFileSync } from "node:fs";
import { poseidonContract } from "circomlibjs";
writeFileSync("test/fixtures/poseidon2.hex", poseidonContract.createCode(2));
writeFileSync("test/fixtures/poseidon3.hex", poseidonContract.createCode(3));
console.log("wrote test/fixtures/poseidon{2,3}.hex");
