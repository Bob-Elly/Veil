import { createWalletClient, http, publicActions, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const DEPLOYER_PK = process.env.DEPLOYER_PK;
if (!DEPLOYER_PK) throw new Error("Missing DEPLOYER_PK");

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const abi = [
    parseAbiItem("function register(string name, string description, string metadataURI) external returns (uint256 id)")
];

async function main() {
    const account = privateKeyToAccount(DEPLOYER_PK.startsWith('0x') ? DEPLOYER_PK as `0x${string}` : `0x${DEPLOYER_PK}`);
    
    const client = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http("https://testnet-rpc.monad.xyz")
    }).extend(publicActions);

    console.log("Registering Demo API in ERC-8004 Identity Registry...");
    
    // In a real scenario, upload JSON to IPFS/Arweave. For the hackathon demo, we inline or mock a URI.
    const demoApiMetadata = JSON.stringify({
        "veilAddress": "veil:0x8335b308bc7226d2e24b51aa7a52a986b5f27e1960103700ecffc9d8fad4fa50", // Relayer/Demo API Veil Address
        "acceptsShielded": true
    });
    const encodedUri = `data:application/json;base64,${Buffer.from(demoApiMetadata).toString('base64')}`;

    try {
        const { request } = await client.simulateContract({
            address: IDENTITY_REGISTRY,
            abi,
            functionName: "register",
            args: ["Veil Quote API", "Paid API accepting shielded USDC", encodedUri]
        });

        const hash = await client.writeContract(request);
        console.log(`Registered! Tx Hash: ${hash}`);
    } catch (e: any) {
        console.log("Skipping on-chain registration due to error:", e.shortMessage || e.message);
    }
}

main().catch(console.error);
