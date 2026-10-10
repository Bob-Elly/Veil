import { Note } from "./note.js";

export function selectInputs(notes: Note[], target: bigint): { inputs: Note[]; change: bigint; needsMerge?: Note[] } {
    const sorted = [...notes].sort((a, b) => (a.amount < b.amount ? 1 : -1));
    const single = sorted.slice().reverse().find((n) => n.amount >= target);
    if (single) {
        return { inputs: [single], change: single.amount - target };
    }
    let bestPair: Note[] | null = null;
    let bestSum = 0n;
    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const sum = sorted[i].amount + sorted[j].amount;
            if (sum >= target) {
                if (!bestPair || sum < bestSum) {
                    bestPair = [sorted[i], sorted[j]];
                    bestSum = sum;
                }
            }
        }
    }
    if (bestPair) {
        return { inputs: bestPair, change: bestSum - target };
    }
    if (sorted.length >= 2) {
        return { inputs: [], change: 0n, needsMerge: [sorted[0], sorted[1]] };
    }
    throw new Error("insufficient balance");
}
