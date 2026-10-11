# Privacy Model — Veil

## What is Hidden
- **Transfers inside the pool:** Who paid whom inside the shielded pool is cryptographically hidden via Groth16 zero-knowledge proofs over the BN254 elliptic curve.
- **Transfer amounts:** Amounts sent between Veil addresses are encrypted with XChaCha20-Poly1305 using ephemeral Diffie-Hellman keys derived from the recipient's view key.
- **Deposit-Withdrawal links:** There is no on-chain cryptographic link between an initial depositor and a downstream withdrawal recipient.
- **Contractor and KOL earnings:** A contractor or KOL's aggregate balance and payout history across multiple StreamVault campaigns cannot be determined by observing on-chain events.
- **Agent spending history:** Autonomous AI agents transacting via the MetaMask Agent Wallet plugin settle payments privately without exposing their transaction history or recipient graph.

## What is Public
- **Deposits and withdrawals:** Token deposit amounts, withdrawal amounts, and the public EOA addresses interacting with the pool are visible on Monad explorer.
- **StreamVault campaign rules:** Payout rates per 1,000 impressions, campaign caps, and StreamVault contract configurations are public.
- **Transaction timing & blocks:** The block number and timestamp when a `NewCommitment` or `NewNullifier` is emitted on-chain.
- **Transaction gas payments:** Gas paid by the relayer or depositing EOA.

## Self-Custodial Guarantee
- **No Operator:** Proofs are generated client-side inside the user's browser (Web Worker) or local agent environment. No private keys, viewing keys, or plaintext notes are ever sent to an operator or relayer.
- **Opt-In Disclosure:** Users can share individual note openings as cryptographic receipts (`/verify#<data>`) or export their read-only auditor viewing key (`veilview:...`) to certified accountants without granting spend capability.

## Anonymity Set Best Practices
- Users are advised to avoid depositing and immediately withdrawing identical amounts.
- Transact in standard denominations to avoid statistical amount correlation.
- Use fresh withdrawal addresses.
