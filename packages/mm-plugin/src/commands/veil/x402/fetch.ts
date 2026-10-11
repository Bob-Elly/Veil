import { Command, Flags } from "@oclif/core";
import { getAgentKeys } from "../../../keys.js";
import { getNodeProver } from "../../../prover.js";
import { checkGuard } from "../../../guard.js";
import { MerkleTree } from "@veil/sdk/dist/tree.js";
import { buildTransfer } from "@veil/sdk/dist/tx.js";
import { selectInputs } from "@veil/sdk/dist/coinSelect.js";
import { syncNotes } from "../../../../../../apps/web/src/lib/sync.js"; 
import { submitToRelayer } from "../../../../../../apps/web/src/lib/relayer.js";
import { parseUnits, formatUnits } from "viem";

export default class X402FetchCommand extends Command {
  static description = "Fetch a paid API resource using x402 shielded payments";

  static flags = {
    method: Flags.string({ description: "HTTP method", default: "GET" }),
    body: Flags.string({ description: "JSON body" }),
    max: Flags.string({ description: "Max USDC willing to pay", required: true }),
    "chain-id": Flags.integer({ description: "Chain ID", required: true }),
  };

  static args = [
    { name: "url", required: true, description: "URL to fetch" }
  ];

  async run() {
    const { args, flags } = await this.parse(X402FetchCommand);
    const chainId = flags["chain-id"];
    
    const ctx = (global as any).mmContext;
    if (!ctx) throw new Error("Must run within mm CLI");

    const wallet = ctx.session.account;
    const maxPayStr = flags.max;
    const maxPay = parseUnits(maxPayStr, 6);

    this.log(`Fetching ${args.url}...`);
    const options: any = { method: flags.method };
    if (flags.body) {
        options.body = flags.body;
        options.headers = { "Content-Type": "application/json" };
    }

    const initialRes = await fetch(args.url, options);
    
    if (initialRes.status !== 402) {
        const text = await initialRes.text();
        this.log(`Received ${initialRes.status}: ${text}`);
        return { status: initialRes.status, body: text };
    }

    this.log("402 Payment Required intercepted.");
    const paymentReq = initialRes.headers.get("PAYMENT-REQUIRED");
    if (!paymentReq) throw new Error("402 response missing PAYMENT-REQUIRED header");

    const reqData = JSON.parse(Buffer.from(paymentReq, "base64").toString("utf-8"));
    const shielded = reqData.accepts.find((a: any) => a.scheme === "shielded");
    
    if (!shielded) throw new Error("Server does not accept shielded payments");

    const amount = BigInt(shielded.amount);
    const fee = BigInt(shielded.extra.fee || "0");
    const totalPay = amount + fee;

    if (totalPay > maxPay) {
        throw new Error(`Requested amount ${formatUnits(totalPay, 6)} exceeds max flag ${maxPayStr}`);
    }

    const totalStr = formatUnits(totalPay, 6);
    this.log("Checking guard policy for x402 payment...");
    checkGuard(wallet, totalStr, shielded.payTo);

    this.log("Authenticating agent key...");
    const keys = await getAgentKeys(ctx, chainId);

    this.log("Syncing notes...");
    const poolAddress = shielded.extra.pool;
    const { notes } = await syncNotes(poolAddress, keys, [], 0n, 0n);
    const available = notes.filter(n => !n.spent);

    const selection = selectInputs(available, totalPay);
    if (selection.needsMerge) throw new Error("Needs merge - combine balances first");

    this.log("Generating ZK Proof locally...");
    const prover = await getNodeProver();
    const tree = new MerkleTree();
    for (const n of notes) await tree.insert(n.commitment!); 
    
    const { proofArgs, extData } = await buildTransfer(
        shielded.payTo, 
        amount, 
        fee, 
        shielded.extra.relayer, 
        selection.inputs, 
        keys, 
        tree, 
        prover
    );
    
    const payloadBytes = Buffer.from(JSON.stringify({
        x402Version: 2,
        accepted: shielded,
        payload: {
            proof: {
                ...proofArgs,
                a: proofArgs.a.map(String),
                b: proofArgs.b.map((x: bigint[]) => x.map(String)),
                c: proofArgs.c.map(String),
                root: String(proofArgs.root),
                publicAmount: String(proofArgs.publicAmount),
                extDataHash: String(proofArgs.extDataHash),
                inputNullifiers: proofArgs.inputNullifiers.map(String),
                outputCommitments: proofArgs.outputCommitments.map(String)
            },
            extData: {
                recipient: extData.recipient,
                extAmount: String(extData.extAmount),
                relayer: extData.relayer,
                fee: String(extData.fee),
                encryptedOutput1: extData.encryptedOutput1,
                encryptedOutput2: extData.encryptedOutput2
            },
            paymentOutput: 0
        }
    })).toString("base64");

    this.log("Retrying request with PAYMENT-SIGNATURE...");
    
    const finalOptions = {
        ...options,
        headers: {
            ...(options.headers || {}),
            "PAYMENT-SIGNATURE": payloadBytes
        }
    };

    const finalRes = await fetch(args.url, finalOptions);
    const text = await finalRes.text();
    
    this.log(`Received ${finalRes.status}: ${text}`);
    return { status: finalRes.status, body: text };
  }
}
