import { 
    CronCapability, HTTPClient, EVMClient, handler, Runner, getNetwork, encodeCallMsg, bytesToHex, hexToBase64,
    LAST_FINALIZED_BLOCK_NUMBER, ConsensusAggregationByFields, median, type Runtime, type NodeRuntime 
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters, encodeFunctionData, decodeFunctionResult, zeroAddress } from "viem";

const StreamVaultAbi = [
    {
        "type": "function",
        "name": "activePosts",
        "inputs": [
            { "name": "start", "type": "uint256", "internalType": "uint256" },
            { "name": "count", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [
            { "name": "ids", "type": "uint256[]", "internalType": "uint256[]" },
            { "name": "users", "type": "uint64[]", "internalType": "uint64[]" },
            { "name": "lastImpressions", "type": "uint64[]", "internalType": "uint64[]" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "onReport",
        "inputs": [
            { "name": "report", "type": "bytes", "internalType": "bytes" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
];

type Config = { 
    schedule: string; 
    chainSelectorName: string; 
    gasLimit: string; 
    vaults: string[];
    requiredTag: string; 
    requiredMention: string; 
    xApiBase: string;
};

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)]

const onCron = (runtime: Runtime<Config>) => {
    const net = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName });
    if (!net) throw new Error("unknown chain");
    
    const evm = new EVMClient(net.chainSelector.selector);
    const token = runtime.getSecret({ id: "X_BEARER_TOKEN" }).result().value;

    for (const vault of runtime.config.vaults) {
        // 1 EVM read
        const res = evm.callContract(runtime, { 
            call: encodeCallMsg({ 
                from: zeroAddress, 
                to: vault as `0x${string}`,
                data: encodeFunctionData({ 
                    abi: StreamVaultAbi, 
                    functionName: "activePosts", 
                    args: [0n, 12n] 
                }) 
            }),
            blockNumber: LAST_FINALIZED_BLOCK_NUMBER 
        }).result();

        const [ids, users] = decodeFunctionResult({ 
            abi: StreamVaultAbi, 
            functionName: "activePosts", 
            data: bytesToHex(res.data) 
        }) as [bigint[], bigint[], bigint[]];

        if (ids.length === 0) continue;

        const imps: bigint[] = [];
        const valid: boolean[] = [];

        for (let i = 0; i < ids.length; i++) {
            const r = runtime.runInNodeMode(
                (nr: NodeRuntime<Config>) => fetchPost(nr, token, ids[i], users[i]),
                ConsensusAggregationByFields<{ impressions: number; valid: number }>({ 
                    impressions: median<number>(), 
                    valid: median<number>() 
                })
            )().result();
            
            imps.push(BigInt(Math.floor(r.impressions))); 
            valid.push(r.valid >= 1);
        }

        const payload = encodeAbiParameters(
            parseAbiParameters("uint256[] ids, uint64[] imps, bool[] valid"), 
            [ids, imps, valid]
        );
        
        const report = runtime.report({ 
            encodedPayload: hexToBase64(payload), 
            encoderName: "evm", 
            signingAlgo: "ecdsa", 
            hashingAlgo: "keccak256" 
        }).result();
        
        evm.writeReport(runtime, { 
            receiver: vault, 
            report, 
            gasConfig: { gasLimit: runtime.config.gasLimit } 
        }).result();
    }
    
    return "ok";
}

function fetchPost(nr: NodeRuntime<Config>, token: string, id: bigint, xUserId: bigint) {
    const http = new HTTPClient();
    try {
        const resp = http.sendRequest(nr, { 
            method: "GET",
            url: `${nr.config.xApiBase}/tweets/${id}?tweet.fields=public_metrics,author_id,text`,
            headers: { Authorization: `Bearer ${token}` } 
        }).result();
        
        if (resp.statusCode !== 200) return { impressions: 0, valid: 0 };
        
        const j = JSON.parse(new TextDecoder().decode(resp.body));
        if (!j.data) return { impressions: 0, valid: 0 };
        
        const text = String(j.data.text ?? "").toLowerCase();
        const ok = String(j.data.author_id) === xUserId.toString()
            && text.includes(nr.config.requiredTag.toLowerCase())
            && text.includes(nr.config.requiredMention.toLowerCase());
            
        return { 
            impressions: Number(j.data.public_metrics?.impression_count ?? 0), 
            valid: ok ? 1 : 0 
        };
    } catch (err) {
        return { impressions: 0, valid: 0 };
    }
}

export async function main() { 
    const runner = await Runner.newRunner<Config>(); 
    await runner.run(initWorkflow);
}
