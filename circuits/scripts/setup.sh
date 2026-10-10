#!/usr/bin/env bash
# Veil circuit pipeline: compile → Groth16 setup → 2 dev contributions + beacon → vkey + Solidity verifier.
# DEV CEREMONY ONLY. Every run makes NEW keys: proofs from old keys stop verifying and the verifier
# contract must be redeployed together with a new VeilPool.
# Requirements: circom 2.1.6+ (we used 2.2.2), node 20+, `npm i` in this folder (circomlib 2.0.5, snarkjs 0.7.5).
set -euo pipefail
cd "$(dirname "$0")/.."
S=node_modules/.bin/snarkjs
mkdir -p build
PTAU=pot16.ptau
if [ ! -f "$PTAU" ]; then
  # Hermez/zkevm ptau links now return 403. Use the PSE perpetual powers of tau (2^16 = 65,536 constraints max).
  curl -L -o "$PTAU" https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_16.ptau
fi
echo "ptau sha256: $(sha256sum $PTAU | cut -d' ' -f1)  (expected ed3622a7c79b0b49aadd134ebbc5b77df8c8c59bccebdfd0d9bf2c1a51561cf9)"

circom src/transaction2x2.circom --r1cs --wasm --sym -o build
$S r1cs info build/transaction2x2.r1cs

$S groth16 setup build/transaction2x2.r1cs $PTAU build/tx_0.zkey
# ALWAYS pass -e: without it snarkjs waits for keyboard entropy and the script hangs forever.
$S zkey contribute build/tx_0.zkey build/tx_1.zkey --name="veil-dev-1" -e="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
$S zkey contribute build/tx_1.zkey build/tx_2.zkey --name="veil-dev-2" -e="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
$S zkey beacon build/tx_2.zkey build/transaction2x2_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="veil-beacon"
$S zkey export verificationkey build/transaction2x2_final.zkey build/vkey.json
$S zkey export solidityverifier build/transaction2x2_final.zkey build/Verifier.sol
rm -f build/tx_0.zkey build/tx_1.zkey build/tx_2.zkey

echo "wasm  sha256: $(sha256sum build/transaction2x2_js/transaction2x2.wasm | cut -d' ' -f1)"
echo "zkey  sha256: $(sha256sum build/transaction2x2_final.zkey | cut -d' ' -f1)"
echo "Copy build/Verifier.sol to contracts/src/Verifier.sol and pin the two hashes above in the SDK."
