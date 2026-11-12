import "server-only";
import { provider, selfTest } from "./storage";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getSecurityRules } from "firebase-admin/security-rules";
import { accessToken, adminAuth, projectId } from "./admin";
import indexes from "../../../firestore.indexes.json";

export interface StepResult {
  step: string;
  ok: boolean;
  detail: string;
}

const file = (name: string) => readFileSync(path.join(process.cwd(), name), "utf8");

async function google(method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}
const errMsg = (j: Record<string, unknown>) => String((j.error as { message?: string } | undefined)?.message ?? "unknown error");

/** Email sign-in, authenticator-app 2FA, strong password policy, email-enumeration protection, authorised domain. */
export async function configureAuth(host: string): Promise<StepResult> {
  const p = projectId();
  try {
    const init = await google("POST", `https://identitytoolkit.googleapis.com/v2/projects/${p}/identityPlatform:initializeAuth`, {});
    if (!init.ok && !/already|ALREADY/i.test(errMsg(init.json)))
      return { step: "Sign-in security", ok: false, detail: `Could not enable Identity Platform (${errMsg(init.json)}). In the Firebase console open Authentication → Settings and click "Upgrade", then run setup again.` };
    const cfg = await google("GET", `https://identitytoolkit.googleapis.com/admin/v2/projects/${p}/config`);
    const domains = new Set<string>(((cfg.json.authorizedDomains as string[]) ?? []).concat(host ? [host] : []));
    const patch = await google("PATCH", `https://identitytoolkit.googleapis.com/admin/v2/projects/${p}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`, {
      signIn: { email: { enabled: true, passwordRequired: true } },
      authorizedDomains: [...domains],
    });
    if (!patch.ok) return { step: "Sign-in security", ok: false, detail: `Could not enable email sign-in (${errMsg(patch.json)}).` };
    await adminAuth().projectConfigManager().updateProjectConfig({
      multiFactorConfig: { state: "ENABLED", providerConfigs: [{ state: "ENABLED", totpProviderConfig: { adjacentIntervals: 5 } }] },
      passwordPolicyConfig: {
        enforcementState: "ENFORCE",
        forceUpgradeOnSignin: true,
        constraints: { requireUppercase: true, requireLowercase: true, requireNumeric: true, minLength: 10, maxLength: 64 },
      },
      emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
    });
    return { step: "Sign-in security", ok: true, detail: "Email sign-in, authenticator 2FA, password policy and email-enumeration protection are on." };
  } catch (e) {
    return { step: "Sign-in security", ok: false, detail: `Failed: ${(e as Error).message}` };
  }
}

export async function deployRules(): Promise<StepResult> {
  try {
    const rules = getSecurityRules();
    await rules.releaseFirestoreRulesetFromSource(file("firestore.rules"));
    if (provider() === "cloudinary") return { step: "Security rules", ok: true, detail: "Database rules installed. Files are kept on Cloudinary (private, signed), so no Firebase Storage rules are needed." };
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) return { step: "Security rules", ok: false, detail: "Database rules installed, but the storage bucket name is not set (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)." };
    await rules.releaseStorageRulesetFromSource(file("storage.rules"), bucket);
    return { step: "Security rules", ok: true, detail: "Database and file-storage rules installed." };
  } catch (e) {
    const m = (e as Error).message;
    return { step: "Security rules", ok: false, detail: /not found|NOT_FOUND|does not exist/i.test(m) ? "Create the Firestore database and Storage bucket in the Firebase console first, then run this again." : `Failed: ${m}` };
  }
}

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };

export async function deployIndexes(): Promise<StepResult> {
  const p = projectId();
  const base = `https://firestore.googleapis.com/v1/projects/${p}/databases/(default)/collectionGroups`;
  let created = 0, existing = 0;
  const failed: string[] = [];
  try {
    for (const ix of indexes.indexes as { collectionGroup: string; queryScope: string; fields: IndexField[] }[]) {
      const r = await google("POST", `${base}/${ix.collectionGroup}/indexes`, { queryScope: ix.queryScope, fields: ix.fields });
      if (r.ok) created++;
      else if (r.status === 409 || /already exists/i.test(errMsg(r.json))) existing++;
      else failed.push(`${ix.collectionGroup}: ${errMsg(r.json)}`);
    }
    for (const fo of indexes.fieldOverrides as { collectionGroup: string; fieldPath: string; indexes: object[] }[]) {
      const r = await google("PATCH", `${base}/${fo.collectionGroup}/fields/${fo.fieldPath}?updateMask=indexConfig`, { indexConfig: { indexes: fo.indexes } });
      if (!r.ok && !/already/i.test(errMsg(r.json))) failed.push(`${fo.collectionGroup}.${fo.fieldPath}: ${errMsg(r.json)}`);
    }
  } catch (e) {
    failed.push((e as Error).message);
  }
  return failed.length
    ? { step: "Database indexes", ok: false, detail: `${created} created, ${existing} already present; ${failed.length} failed (${failed[0]}). Retry from Settings → System.` }
    : { step: "Database indexes", ok: true, detail: `${created} created, ${existing} already present. New indexes take a few minutes to finish building.` };
}

/** Prove file storage works end to end (upload, signed read, delete). */
export async function checkStorage(): Promise<StepResult> {
  const r = await selfTest();
  return { step: "File storage", ok: r.ok, detail: r.ok ? r.detail : `${r.detail}. Check the ${r.provider === "cloudinary" ? "CLOUDINARY_* settings" : "Storage bucket (Firebase console → Storage) and the Blaze plan"}, then retry from Settings → System.` };
}
