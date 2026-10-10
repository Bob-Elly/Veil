import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  isMeraError
} from "@category-labs/mera";
import { keysFromPrf } from "@veil/sdk";
import { privateKeyToAccount } from "viem/accounts";

export type VeilSession = {
  prfOutput: Uint8Array;
  keys: Awaited<ReturnType<typeof keysFromPrf>>;
  publicAccount: ReturnType<typeof privateKeyToAccount>;
};

// Use an in-memory session
let currentSession: VeilSession | null = null;
let sessionListeners: ((s: VeilSession | null) => void)[] = [];

export function onSessionChange(fn: (s: VeilSession | null) => void) {
  sessionListeners.push(fn);
  fn(currentSession);
  return () => {
    sessionListeners = sessionListeners.filter(l => l !== fn);
  };
}

function setSession(session: VeilSession | null) {
  currentSession = session;
  sessionListeners.forEach(l => l(session));
}

export function getSession() {
  return currentSession;
}

export async function loginOrRegister(forceCreate = false) {
  try {
    const stored = localStorage.getItem("veil.credential");
    const known = stored ? JSON.parse(stored) : undefined;
    
    let prfOutput: Uint8Array;
    let credentialId: string;
    
    if (!known || forceCreate) {
      // Create a passkey
      const created = await createPasskeyWithPrfOutput({
        rp: { id: location.hostname, name: "Veil" },
        user: { name: "user-" + Date.now() + "@veil.example", displayName: "Veil User" },
      });
      prfOutput = created.prfOutput;
      credentialId = created.credentialId;
      
      localStorage.setItem("veil.credential", JSON.stringify({
        credentialId: created.credentialId,
        transports: created.transports,
      }));
    } else {
      // Login with known passkey
      const res = await getPasskeyPrfOutput({
        rpId: location.hostname,
        credential: known,
      });
      prfOutput = res.prfOutput;
      credentialId = res.credentialId;
      
      localStorage.setItem(
        "veil.credential",
        JSON.stringify(known?.credentialId === credentialId ? known : { credentialId })
      );
    }
    
    // Derive the keys
    const keys = await keysFromPrf(prfOutput);
    // Viem account from the public EOA key
    const hexKey = `0x${Buffer.from(keys.publicAccountKey).toString("hex")}` as `0x${string}`;
    const publicAccount = privateKeyToAccount(hexKey);
    
    setSession({ prfOutput, keys, publicAccount });
  } catch (error) {
    if (isMeraError(error)) {
      console.error("Mera Error:", error.code);
      throw error;
    }
    throw error;
  }
}

export function logout() {
  // Wipe in memory keys
  if (currentSession) {
    currentSession.prfOutput.fill(0);
    // @ts-ignore
    currentSession.keys.publicAccountKey.fill(0);
    currentSession.keys.atRestKey.fill(0);
    currentSession = null;
    setSession(null);
  }
}
