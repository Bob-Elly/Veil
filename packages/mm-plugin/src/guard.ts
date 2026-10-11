import fs from "fs";
import { getGuardPath } from "./state.js";
import { parseUnits } from "viem";

export type GuardPolicy = {
    perPayment: string; // amount string
    daily: string;
    allow: string[]; // addresses
    expires: string;
};

export type SpendLog = {
    timestamp: number;
    amount: string;
};

export type GuardState = {
    policy: GuardPolicy;
    log: SpendLog[];
};

export function readGuard(walletAddress: string): GuardState | null {
    const p = getGuardPath(walletAddress);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function writeGuard(walletAddress: string, state: GuardState) {
    const p = getGuardPath(walletAddress);
    fs.writeFileSync(p, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function checkGuard(walletAddress: string, amount: string, recipient?: string) {
    const state = readGuard(walletAddress);
    if (!state) throw new Error("Guard denies spend: no policy file exists.");

    const now = Date.now();
    if (new Date(state.policy.expires).getTime() < now) {
        throw new Error("Guard denies spend: policy expired.");
    }

    const amt = parseUnits(amount, 6);
    const perPayment = parseUnits(state.policy.perPayment, 6);
    if (amt > perPayment) {
        throw new Error(`Guard denies spend: amount ${amount} exceeds per-payment cap ${state.policy.perPayment}`);
    }

    if (recipient && state.policy.allow.length > 0 && !state.policy.allow.includes(recipient)) {
        throw new Error(`Guard denies spend: recipient ${recipient} not in allowlist`);
    }

    const daily = parseUnits(state.policy.daily, 6);
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    let recentSpend = 0n;
    state.log = state.log.filter(l => l.timestamp > oneDayAgo);
    for (const l of state.log) recentSpend += parseUnits(l.amount, 6);

    if (recentSpend + amt > daily) {
        throw new Error(`Guard denies spend: amount exceeds daily cap ${state.policy.daily}`);
    }

    // Reserve
    state.log.push({ timestamp: now, amount });
    writeGuard(walletAddress, state);
}
