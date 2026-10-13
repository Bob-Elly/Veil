import { Args, Command, Flags } from "@oclif/core";
import { formatUnits, parseUnits } from "viem";
import { buildPaymentSignature, decodeX402Header } from "@veil/sdk";
import { getAgentKeys } from "../../../keys.js";
import { checkGuard } from "../../../guard.js";
import { nodeProver, poolClient } from "../../../veil.js";

export default class X402FetchCommand extends Command {
  static description = "Fetch a paid API that speaks x402, paying privately with the Veil `shielded` scheme";

  static flags = {
    method: Flags.string({ description: "HTTP method", default: "GET" }),
    body: Flags.string({ description: "JSON body" }),
    max: Flags.string({ description: "Max amount willing to pay (e.g. 0.05)", required: true }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  static args = { url: Args.string({ required: true, description: "URL to fetch" }) };

  async run() {
    const { args, flags } = await this.parse(X402FetchCommand);
    const chainId = flags["chain-id"];
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const options: any = { method: flags.method };
    if (flags.body) { options.body = flags.body; options.headers = { "Content-Type": "application/json" }; }

    this.log(`Fetching ${args.url}...`);
    const first = await fetch(args.url, options);
    if (first.status !== 402) {
      const text = await first.text();
      this.log(`Received ${first.status}: ${text}`);
      return { status: first.status, body: text };
    }

    const header = first.headers.get("PAYMENT-REQUIRED");
    if (!header) throw new Error("402 response missing PAYMENT-REQUIRED header");
    const reqs = decodeX402Header(header);
    const accepted = reqs.accepts.find((a: any) => a.scheme === "shielded" && a.network === `eip155:${chainId}`);
    if (!accepted) throw new Error("Server does not accept Veil shielded payments on this chain");

    const amount = BigInt(accepted.amount);
    const fee = BigInt(accepted.extra?.fee || "0");
    const total = amount + fee;
    if (total > parseUnits(flags.max, 6)) throw new Error(`Price ${formatUnits(total, 6)} exceeds --max ${flags.max}`);

    this.log(`402: price ${formatUnits(total, 6)}. Checking guard policy...`);
    checkGuard(ctx.session.account, formatUnits(total, 6), accepted.payTo);

    const keys = await getAgentKeys(ctx, chainId);
    const symbol = Object.entries((await import("../../../veil.js")).deployments(chainId).pools)
      .find(([, p]: any) => p.address.toLowerCase() === accepted.extra.pool.toLowerCase())?.[0];
    if (!symbol) throw new Error(`Unknown pool ${accepted.extra.pool}`);
    const c = poolClient(chainId, symbol, keys);
    const { proofArgs, extData } = await c.preparePayment(accepted.payTo, amount, fee, accepted.extra.relayer, nodeProver(), (m) => this.log(m));

    this.log("Retrying with PAYMENT-SIGNATURE...");
    const paid = await fetch(args.url, { ...options, headers: { ...(options.headers || {}), "PAYMENT-SIGNATURE": buildPaymentSignature(accepted, chainId, proofArgs, extData) } });
    const text = await paid.text();
    const receipt = paid.headers.get("PAYMENT-RESPONSE");
    this.log(`Received ${paid.status}: ${text}`);
    return { status: paid.status, body: text, payment: receipt ? decodeX402Header(receipt) : null };
  }
}
