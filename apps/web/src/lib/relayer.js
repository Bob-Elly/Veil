export async function submitToRelayer(pool, proofArgs, extData) {
    const res = await fetch("http://localhost:3001/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chainId: 10143,
            pool,
            proof: {
                ...proofArgs,
                a: proofArgs.a.map(String),
                b: proofArgs.b.map((x) => x.map(String)),
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
            }
        })
    });
    const json = await res.json();
    if (!res.ok)
        throw new Error(json.error || "Relay failed");
    return json;
}
