# Threat Model & Security Assumptions — Veil

## Threat Matrix

| Actor | Capabilities (Can) | Mitigations & Limitations (Cannot) |
|---|---|---|
| **Relayer** | Can delay, censor, or refuse to broadcast transactions; observes submitter IP addresses. | **Cannot** alter recipient address, change amount, modify the relayer fee bound to `extDataHash`, or spend notes. |
| **Envio HyperIndex** | Can temporarily serve stale or out-of-order logs. | **Cannot** forge proofs or steal balances. Client-side Merkle tree validation checks `isKnownRoot(root)` on-chain before building transactions. |
| **Pool Owner** | Can pause new deposits or update `maxDepositAmount` limits. | **Cannot** withdraw or confiscate deposited tokens, change the ZK verifier address, or block user withdrawals. |
| **Chainlink CRE / X API** | Could misreport view impressions. | **Cannot** exceed the campaign holdback %, drain beyond the configured budget, or pay unauthorized addresses (payouts are strictly bounded by per-post and per-campaign caps). |
| **Token Issuers (USDC/AUSD)** | Real USDC/AUSD contracts retain token-level freezing and pausing capabilities. | Pool balances could be frozen by the respective token issuer contracts if blacklisted. |
| **Dev Ceremony Participants** | Could theoretically forge proofs if 100% of setup contributors colluded. | Phase 2 Powers of Tau ceremony was generated with random beacon entropy. For production, a community-wide ceremony is mandatory. |
| **Public Observers** | Can observe total pool TVL, deposit amounts, withdrawal amounts, and block timing. | **Cannot** decrypt transfer memos, correlate senders to receivers, or determine note balances inside the tree. |

## Cryptographic Conventions
- **Curve & Field:** BN254 scalar field ($p = 21888242871839275222246405745257275088548364400416034343698204186575808495617$).
- **Hash Function:** Poseidon (1, 2, and 3 inputs).
- **Public Signal Ordering:** `[root, publicAmount, extDataHash, inputNullifier[0], inputNullifier[1], outputCommitment[0], outputCommitment[1]]`.
- **Note Commitments:** $\text{Poseidon}(\text{amount}, \text{pubKey}, \text{blinding})$.
- **Nullifiers:** $\text{Poseidon}(\text{commitment}, \text{index}, \text{signature})$ where $\text{signature} = \text{Poseidon}(\text{privKey}, \text{commitment}, \text{index})$.
