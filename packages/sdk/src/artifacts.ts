export const WASM_SHA256 = "574079929F4A81DD1F4DD1E992E3AC602E0203D666189410E414B0A94BCD3166";
export const ZKEY_SHA256 = "BD33470A44BA4FC2B563F0C6A4CBC6CECF3235CC3D41AD608283821E47C11181";

export async function loadArtifacts(baseUrl: string) {
    const [wasmRes, zkeyRes] = await Promise.all([
        fetch(`${baseUrl}/transaction2x2.wasm`),
        fetch(`${baseUrl}/transaction2x2_final.zkey`)
    ]);
    const wasm = new Uint8Array(await wasmRes.arrayBuffer());
    const zkey = new Uint8Array(await zkeyRes.arrayBuffer());
    return { wasm, zkey };
}
