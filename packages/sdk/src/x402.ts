import { serializeRelayRequest } from "./client.js";

/**
 * Veil x402 "shielded" scheme (x402 v2 headers: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE,
 * each base64(JSON)). The payer proves a private transfer to the merchant's veil: address; the merchant
 * decrypts output 0, checks the commitment and amount, then relays the proof.
 */
export const X402_SCHEME = "shielded";

// Headers are ASCII JSON; btoa/atob exist in browsers and Node >= 16.
const b64 = (s: string) => btoa(s);
const unb64 = (s: string) => atob(s);

export const encodeX402Header = (obj: unknown) => b64(JSON.stringify(obj));
export const decodeX402Header = <T = any>(h: string): T => JSON.parse(unb64(h));

export function buildPaymentSignature(accepted: any, chainId: number, proofArgs: any, extData: any) {
    const req = serializeRelayRequest(chainId, accepted.extra.pool, proofArgs, extData);
    return encodeX402Header({ x402Version: 2, accepted, payload: { proof: req.proof, extData: req.extData, paymentOutput: 0 } });
}
