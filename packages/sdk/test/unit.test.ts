import { expect, test, describe } from "vitest";
import { randomBytes } from "crypto";
import { selectInputs } from "../src/coinSelect.js";
import { formatAddress, parseAddress } from "../src/address.js";
import { VeilKeys } from "../src/keys.js";
import { MerkleTree } from "../src/tree.js";
import { encryptNote, decryptNote, readMemo } from "../src/memo.js";

function randomField() {
    return BigInt('0x' + Buffer.from(randomBytes(31)).toString('hex'));
}

describe("SDK Unit Tests", () => {
    test("Coin Selection", () => {
        const dummyNote = (amount: bigint) => ({ amount, pubKey: 0n, blinding: 0n, index: 0, privKey: 0n });
        const notes = [dummyNote(5n), dummyNote(2n), dummyNote(1n), dummyNote(8n)];
        
        // 1. One note
        let res = selectInputs(notes, 4n);
        expect(res.inputs.length).toBe(1);
        expect(res.inputs[0].amount).toBe(5n);
        expect(res.change).toBe(1n);

        // 2. A pair
        res = selectInputs(notes, 9n);
        expect(res.inputs.length).toBe(2);
        expect(res.inputs[0].amount).toBe(8n);
        expect(res.inputs[1].amount).toBe(1n);
        expect(res.change).toBe(0n);

        // 3. Needs merge
        res = selectInputs(notes, 14n);
        expect(res.inputs.length).toBe(0);
        expect(res.needsMerge?.length).toBe(2);
        expect(res.needsMerge![0].amount).toBe(8n);
        expect(res.needsMerge![1].amount).toBe(5n);

        // 4. Exact match
        res = selectInputs(notes, 8n);
        expect(res.inputs.length).toBe(1);
        expect(res.inputs[0].amount).toBe(8n);
        expect(res.change).toBe(0n);
    });

    test("Address round trip", async () => {
        const keys = await VeilKeys.fromSeed(new Uint8Array(randomBytes(32)));
        const address = formatAddress(keys);
        expect(address.startsWith("veil:0x")).toBe(true);
        const parsed = parseAddress(address);
        expect(parsed.pubKey).toBe(keys.pubKey);
        expect(parsed.encPub).toStrictEqual(keys.encPub);
    });

    test("Memo round trip", async () => {
        const keys = await VeilKeys.fromSeed(new Uint8Array(randomBytes(32)));
        const amount = 123456789n;
        const blinding = await randomField();
        
        const encrypted = encryptNote(keys.encPub, amount, blinding);
        
        const read = readMemo(keys.encPriv, encrypted);
        expect(read).toBeDefined();
        expect(read?.amount).toBe(amount);
        expect(read?.blinding).toBe(blinding);
    });

    test("Tree Cache", async () => {
        const t1 = new MerkleTree();
        const t2 = new MerkleTree();
        
        // Let's just test that the root matches
        t1.leaves.push(1n);
        t2.leaves.push(1n);
        expect(await t1.root()).toBe(await t2.root());
    });
});
