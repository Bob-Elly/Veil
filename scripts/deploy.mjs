import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import fs from 'fs/promises';
import path from 'path';

// Load ABIs and bytecodes from Foundry output
async function getArtifact(contractName, jsonName = contractName) {
    const p = path.resolve(process.cwd(), `../contracts/out/${contractName}.sol/${jsonName}.json`);
    const data = JSON.parse(await fs.readFile(p, 'utf8'));
    return { abi: data.abi, bytecode: data.bytecode.object || data.bytecode };
}

async function getRawBytecode(filepath) {
    const p = path.resolve(process.cwd(), filepath);
    const data = await fs.readFile(p, 'utf8');
    return data.trim().startsWith('0x') ? data.trim() : '0x' + data.trim();
}

async function main() {
    if (!process.env.DEPLOYER_PK) {
        throw new Error("Missing DEPLOYER_PK environment variable");
    }

    const account = privateKeyToAccount(process.env.DEPLOYER_PK.startsWith('0x') ? process.env.DEPLOYER_PK : `0x${process.env.DEPLOYER_PK}`);
    
    const client = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz')
    });
    
    const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz')
    });

    console.log(`Deploying with account: ${account.address}`);
    
    const maxDeposit = 1000n * 1000000n; // Example: 1000 tokens (6 decimals)

    // Helper to deploy and wait for receipt
    async function deployContract(name, bytecode, abi, args = []) {
        console.log(`Deploying ${name}...`);
        const hash = await client.deployContract({
            abi,
            bytecode,
            args
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`${name} deployed at: ${receipt.contractAddress} in block ${receipt.blockNumber}`);
        return { address: receipt.contractAddress, block: Number(receipt.blockNumber) };
    }
    
    // 1. Poseidon2 and Poseidon3
    const p2Bytecode = await getRawBytecode('../contracts/test/fixtures/poseidon2.hex');
    const p3Bytecode = await getRawBytecode('../contracts/test/fixtures/poseidon3.hex');
    
    // Poseidons don't have ABIs we interact with during deployment, so we deploy raw bytecode.
    const p2Hash = await client.sendTransaction({ data: p2Bytecode });
    const p2Receipt = await publicClient.waitForTransactionReceipt({ hash: p2Hash });
    console.log(`Poseidon2 deployed at: ${p2Receipt.contractAddress}`);
    
    const p3Hash = await client.sendTransaction({ data: p3Bytecode });
    const p3Receipt = await publicClient.waitForTransactionReceipt({ hash: p3Hash });
    console.log(`Poseidon3 deployed at: ${p3Receipt.contractAddress}`);

    // 2. Verifier
    const verifierArt = await getArtifact('Verifier', 'Groth16Verifier');
    const verifier = await deployContract('Groth16Verifier', verifierArt.bytecode, verifierArt.abi);

    // 3. USDC Pool
    const usdcAddress = '0x534b2f3A21130d7a60830c2Df862319e593943A3'; // Testnet USDC
    const poolArt = await getArtifact('VeilPool');
    const usdcPool = await deployContract('VeilPool (USDC)', poolArt.bytecode, poolArt.abi, [
        verifier.address,
        p2Receipt.contractAddress,
        p3Receipt.contractAddress,
        usdcAddress,
        maxDeposit
    ]);

    // 4. AUSD Pool
    // Deploy Mock AUSD first
    const mockErc20Art = await getArtifact('MockERC20');
    const tAusd = await deployContract('MockERC20 (tAUSD)', mockErc20Art.bytecode, mockErc20Art.abi);
    
    const ausdPool = await deployContract('VeilPool (AUSD)', poolArt.bytecode, poolArt.abi, [
        verifier.address,
        p2Receipt.contractAddress,
        p3Receipt.contractAddress,
        tAusd.address,
        maxDeposit
    ]);

    // 5. StreamVaultFactory
    const factoryArt = await getArtifact('StreamVaultFactory');
    const factory = await deployContract('StreamVaultFactory', factoryArt.bytecode, factoryArt.abi);
    
    // Write deployments/testnet.json
    const deploymentData = {
        chainId: 10143,
        poseidon2: p2Receipt.contractAddress,
        poseidon3: p3Receipt.contractAddress,
        verifier: verifier.address,
        pools: {
            USDC: {
                address: usdcPool.address,
                token: usdcAddress,
                decimals: 6,
                deployBlock: usdcPool.block
            },
            AUSD: {
                address: ausdPool.address,
                token: tAusd.address,
                decimals: 6,
                deployBlock: ausdPool.block,
                mock: true
            }
        },
        streamVaultFactory: factory.address,
        verifiedPool: null,
        cvi: null,
        zkey_sha256: "5d64f2162ef439ae53f0e3c61f276245f7fa1b934907ef66ce3cf149056acad0",
        wasm_sha256: "e44f07497b34f3498352da5bfd9fd7a100c2e8cb7ebddc643f1e6e29d4dfcf6a"
    };

    await fs.mkdir(path.resolve(process.cwd(), '../deployments'), { recursive: true });
    await fs.writeFile(
        path.resolve(process.cwd(), '../deployments/testnet.json'),
        JSON.stringify(deploymentData, null, 2)
    );
    console.log('Deployment complete! Wrote ../deployments/testnet.json');
}

main().catch(console.error);
