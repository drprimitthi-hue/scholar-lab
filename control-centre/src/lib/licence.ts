// Shared licence format. Identical copies: shared/licence.ts and control-centre/src/lib/licence.ts (a unit test checks they match).
// Tokens: base64url(JSON payload) + "." + base64url(Ed25519 signature). Node runtime only.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

export interface LicencePayload {
  v: 1;
  labId: string;
  labName: string;
  domains: string[];
  iat: number; // issued at (ms)
  exp: number | null; // expiry (ms); null = never expires
  grace: number; // read-only days after expiry
}

export interface StatusPayload {
  v: 1;
  labId: string;
  status: "active" | "suspended" | "revoked" | "unknown";
  readOnlyUntil: number | null; // ms; after this a revoked lab is fully locked
  message: string;
  token: string | null; // a newer licence token (renewal), if any
  at: number;
}

const b64u = (b: Buffer) => b.toString("base64url");

export function generateKeys(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
}

export function signObject(obj: object, privateKeyB64: string): string {
  const key = createPrivateKey({ key: Buffer.from(privateKeyB64, "base64"), format: "der", type: "pkcs8" });
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  return `${b64u(body)}.${b64u(sign(null, body, key))}`;
}

/** Returns the decoded object if the signature is valid, else null. */
export function verifyObject<T>(token: string, publicKeyB64: string): T | null {
  try {
    if (typeof token !== "string" || token.length > 8192) return null;
    const [b, s] = token.split(".");
    if (!b || !s) return null;
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, "base64"), format: "der", type: "spki" });
    const body = Buffer.from(b, "base64url");
    if (!verify(null, body, key, Buffer.from(s, "base64url"))) return null;
    return JSON.parse(body.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export type LicenceLevel = "ok" | "readonly" | "locked";

export interface LicenceState {
  level: LicenceLevel;
  reason: string;
  expiresAt: number | null;
}

/** Decide what the lab may do, from its licence and the latest status from the Control Centre. */
export function licenceState(lic: LicencePayload | null, status: StatusPayload | null, now: number): LicenceState {
  if (!lic) return { level: "locked", reason: "No valid licence key is installed.", expiresAt: null };
  const DAY = 86_400_000;
  if (status && status.labId === lic.labId) {
    if (status.status === "revoked") {
      return status.readOnlyUntil && now < status.readOnlyUntil
        ? { level: "readonly", reason: status.message || "This lab's licence has been revoked. Data can be exported until access closes.", expiresAt: lic.exp }
        : { level: "locked", reason: status.message || "This lab's licence has been revoked.", expiresAt: lic.exp };
    }
    if (status.status === "suspended")
      return { level: "readonly", reason: status.message || "This lab's licence is suspended. The app is read-only.", expiresAt: lic.exp };
  }
  if (lic.exp !== null && now > lic.exp) {
    return now < lic.exp + lic.grace * DAY
      ? { level: "readonly", reason: "The licence has expired. The app is read-only until it is renewed.", expiresAt: lic.exp }
      : { level: "locked", reason: "The licence has expired.", expiresAt: lic.exp };
  }
  return { level: "ok", reason: "", expiresAt: lic.exp };
}
