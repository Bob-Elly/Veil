import { Command } from "@oclif/core";

const SKILL = `# Veil private payments (mm veil)

Use these commands to hold and spend a PRIVATE stablecoin balance on Monad. Amounts, senders and
recipients are hidden on-chain; proofs are generated locally. Every spend is checked against the
owner's guard policy (per-payment cap, daily cap, allowlist, expiry) before any proof is built.

- mm veil setup --chain-id 10143                 one-time: derive the agent's Veil key from a wallet signature
- mm veil deposit --amount 10 --chain-id 10143   fund from the MetaMask wallet (approve + depositTo)
- mm veil balance --chain-id 10143               private balance and veil: address
- mm veil pay --to veil:0x… --amount 1 --chain-id 10143
- mm veil withdraw --to 0x… --amount 1 --chain-id 10143
- mm veil x402 fetch <url> --max 0.05 --chain-id 10143   pay an x402 API privately (scheme "shielded")
- mm veil guard get | guard set --per-payment 1 --daily 10 --allow veil:0x…
- mm veil receipt --chain-id 10143               shareable note openings (verify at /verify)

Rules: never raise the guard yourself; if a command says "Guard denies spend", stop and ask the owner.
Use --max on x402 calls. Pools: USDC, AUSD (--pool).`;

export default class SkillCommand extends Command {
  static description = "Print the SKILL.md instructions for agents using this plugin";

  async run() {
    this.log(SKILL);
    return { status: "success", skill: SKILL };
  }
}
