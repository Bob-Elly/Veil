# Veil reference contracts

- `src/VeilPool.sol` — shielded pool for one ERC-20 (2-in/2-out `transact`, `depositTo`).
- `src/MerkleTreeWithHistory.sol` — depth-20 Poseidon tree, permanent root history.
- `src/StreamVault.sol` + `src/StreamVaultFactory.sol` — campaign vault: CRE impression payouts, holdback, per-second streams.
- `src/VerifiedVeilPool.sol` + `src/interfaces/ICviOracle.sol` + `src/MockCviOracle.sol` — Cleanverse "verified mode" (CVI gate on deposit and withdrawal).
- `src/Verifier.sol` — NOT included: generate it with `../circuits/scripts/setup.sh` (it must match your zkey).
- `test/fixtures/poseidon{2,3}.hex` — circomlibjs Poseidon bytecode (regenerate with `scripts/gen-poseidon-fixtures.mjs`).
