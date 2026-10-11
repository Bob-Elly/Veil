# Prior Art, Inspirations & Dependencies — Veil

Veil is built from the ground up for Monad Metropolis (Track 04: Trust, Identity & AI Infra), drawing architectural inspiration from established privacy protocols and tooling:

1. **Gloam (cryptoduke01/gloam):**
   - Architectural inspiration for client-side proving paradigms, event-driven state syncing, and security lessons from their audit disclosures.
   - *Note:* Veil does **not** copy Gloam code; Veil uses a 2-in/2-out note model with leaf indices bound into nullifiers for zero double-spend risks.

2. **Tornado Nova (Tornado Cash 2-in/2-out Design):**
   - Inspiration for the 2-input, 2-output transaction circuit enabling simultaneous private payment and change-note returns within a single atomic proof.

3. **circomlib & snarkjs (iden3):**
   - Core primitives for Poseidon hash functions, BN254 scalar field math, and client-side Groth16 zk-SNARK proof generation.

4. **Category Labs Mera:**
   - Passkey authentication and hierarchical key derivation (`m/44'/60'/0'/0/i`) powering the "One Passkey, Many Keys" identity model.

5. **Chainlink CRE (Decentralized Runtime Environment):**
   - Multi-node decentralized consensus workflow aggregating public social impressions and executing on-chain StreamVault payouts.

6. **Envio HyperIndex:**
   - Ultra-fast real-time indexing of `NewCommitment` and `NewNullifier` events on Monad for rapid client-side Merkle tree synchronization.

7. **OpenZeppelin Contracts (v5.1.0):**
   - Standard security libraries (`ReentrancyGuard`, `Ownable2Step`, `IERC20`).
