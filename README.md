# Veil — Private Payments on Monad

> **Pay people and AI agents on Monad without publishing your payroll, marketing budget, or autonomous agent spending history. Only the payer and payee see the transaction details. Proofs are computed directly on your device.**

Built for **Monad Metropolis** · **Track 04: Trust, Identity & AI Infra**.

---

## 🌟 Overview & Features

Veil provides self-custodial, client-side zero-knowledge privacy for stablecoins on Monad:

- **Passkey Onboarding (Mera "One Passkey, Many Keys"):** Sign in via Face ID / Touch ID. A single passkey PRF root deterministically derives your public funding wallet, private spending key, shareable compliance viewing key, at-rest encrypted storage key, and autonomous agent identities.
- **2-in / 2-out ZK Circuit:** Groth16 proofs over BN254 that verify Merkle membership, prevent double-spending with nullifiers, and preserve value conservation while returning private change notes atomically.
- **Confidential Payroll (Agora AUSD & USDC):** Execute bulk contractor payouts from CSV files with crash-safe resumption. Un-onboarded recipients automatically receive zero-knowledge claim links (`/claim#seed`).
- **Autonomous Agent Spending (MetaMask Agent Wallet Plugin):** An `oclif`-compatible plugin (`@veil/mm-plugin`) enabling AI agents to hold private balances and pay for x402 APIs within user-defined policy caps.
- **StreamVault & Chainlink CRE Workflows:** Influencer marketing pools and automated salary drips where Chainlink CRE oracle nodes achieve consensus over X view impressions to trigger private payouts.
- **Verified Mode (Cleanverse CVI/CVA):** Enforce identity compliance on-chain: only Cleanverse-verified wallets can deposit or withdraw.
- **Fund from Any Chain (Aurora Intents):** Cross-chain deposit flow swapping assets from Base/Ethereum into Monad USDC with immediate one-click shielding.
- **Universal Zero-Knowledge Receipts (`/verify`):** Shareable cryptographic note openings verifiable by anyone without connecting a wallet or revealing the sender.
- **High-Speed Indexing (Envio HyperIndex):** Instant Merkle tree reconstruction and nullifier tracking.

---

## 🏗️ Architecture & Workspaces

The repository is organized as a pnpm monorepo:

```
veil-monad/
├── circuits/           # Circom 2x2 Groth16 circuit & compile scripts
├── contracts/          # Solidity Foundry contracts (VeilPool, StreamVault, Verifier, Cleanverse adapter)
├── packages/
│   ├── sdk/            # @veil/sdk: Poseidon, keys, Merkle tree, proving & tx builders
│   └── mm-plugin/      # @veil/mm-plugin: MetaMask Agent Wallet plugin (`mm veil ...`)
├── services/
│   ├── relayer/        # Hono gas relayer & gas drip service (port 3001)
│   └── cre/            # Chainlink CRE decentralized oracle workflow
├── apps/
│   ├── web/            # Next.js frontend application (Dashboard, Payroll, Campaigns, Accounts, Verify)
│   └── demo-api/       # x402 shielded demo API
├── indexer/            # Envio HyperIndex configuration & GraphQL schema
└── docs/               # PRIVACY-MODEL.md, THREAT-MODEL.md, PRIOR-ART.md
```

---

## 🚀 Deployed Contracts (Monad Testnet `10143`)

| Component | Address |
|---|---|
| **VeilPool (USDC)** | `0x57c2502f0522d2128f72ea867d2225fb15aeb1d1` |
| **VeilPool (Agora AUSD)** | `0x409b1d63174407550f773d405e4068e147362d18` |
| **Groth16 Verifier** | `0x6b985d08c0a530b972c9c268d6c220b336abf14c` |
| **Poseidon (2-input)** | `0x5d43c929e91d9ff0c4440d3e2b094429b53095f6` |
| **Poseidon (3-input)** | `0x4142f46657ebaaf7383489976cd5169222c89d29` |
| **StreamVault Factory** | `0x6a3a7df1ae3fd0922e3c29935d0e040cfab63560` |
| **Testnet USDC Token** | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

---

## 🛠️ Quickstart

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Foundry (`forge` / `anvil`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Contracts & Tests
```bash
cd contracts
forge test
```

### 3. Run Web App
```bash
cd apps/web
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 🛡️ Sponsor Integrations Summary

- **Mera ($2,500 Best UX / $2,500 One Passkey Many Keys):** Passkey PRF output derives the entire key tree (`apps/web/src/lib/wallet.ts`, `apps/web/src/app/accounts/page.tsx`).
- **MetaMask ($2,500 Best Agent Wallet Plugin):** Plugin implemented in `packages/mm-plugin` with `veil:setup`, `veil:deposit`, `veil:pay`, `veil:guard`, `veil:x402`.
- **Agora ($10,000 Cross-Border Payments):** Dedicated Agora AUSD shielded pool & private CSV payroll engine (`apps/web/src/app/payroll/page.tsx`).
- **Chainlink ($3,000 Best Workflow with CRE):** CRE consensus pipeline reading X impressions and executing payouts in `services/cre/main.ts`.
- **Envio ($1,000 Best Use of Envio):** Event indexer in `indexer/` capturing all pool commitments & nullifiers for real-time tree sync.
- **Cleanverse ($2,000 CVI/CVA Integration):** `contracts/src/VerifiedVeilPool.sol` and `CleanverseCviAdapter.sol` restricting pool operations to verified identities.
- **Aurora ($5,000 Any-Chain Liquidity):** Cross-chain swap widget in `apps/web/src/components/FundAnyChainModal.tsx` querying Aurora Intents API.

---

## 📜 Prior Art & Acknowledgments
Detailed in [`docs/PRIOR-ART.md`](docs/PRIOR-ART.md). Credit to Gloam (architectural reference), Tornado Nova, circomlib, snarkjs, Mera, x402, and Envio.
