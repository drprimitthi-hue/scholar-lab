import "server-only";
import { licenceState, verifyObject, type LicencePayload, type LicenceState, type StatusPayload } from "@shared/licence";
import { db } from "./admin";

export interface LabLicence extends LicenceState {
  payload: LicencePayload | null;
  token: string | null;
  status: StatusPayload | null;
  lastCheck: number | null;
  configured: boolean;
}

let cache: { at: number; value: LabLicence } | null = null;
export const clearLicenceCache = () => (cache = null);

const pub = () => process.env.LICENCE_PUBLIC_KEY ?? "";

/** The best valid licence: newest of the deployment key and any renewal received from the Control Centre. */
export async function currentLicence(): Promise<LabLicence> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  if (process.env.LICENCE_MODE === "off") {
    const value: LabLicence = { level: "ok", reason: "", expiresAt: null, payload: null, token: null, status: null, lastCheck: null, configured: false };
    cache = { at: Date.now(), value };
    return value;
  }
  const snap = await db().doc("system/licence").get();
  const stored = snap.data() as { token?: string; statusToken?: string; lastCheck?: number } | undefined;
  const labId = process.env.LAB_ID;
  const candidates = [process.env.LICENCE_KEY, stored?.token]
    .filter((t): t is string => Boolean(t))
    .map((t) => ({ t, p: verifyObject<LicencePayload>(t, pub()) }))
    .filter((x): x is { t: string; p: LicencePayload } => x.p !== null && x.p.v === 1 && (!labId || x.p.labId === labId))
    .sort((a, b) => b.p.iat - a.p.iat);
  const best = candidates[0] ?? null;
  const status = stored?.statusToken ? verifyObject<StatusPayload>(stored.statusToken, pub()) : null;
  const state = licenceState(best?.p ?? null, status, Date.now());
  const value: LabLicence = { ...state, payload: best?.p ?? null, token: best?.t ?? null, status, lastCheck: stored?.lastCheck ?? null, configured: Boolean(pub()) };
  cache = { at: Date.now(), value };
  return value;
}

/** Publish the non-sensitive licence level so the app can show a banner or lock screen. */
export async function publishLicenceStatus(l: LabLicence): Promise<void> {
  await db().doc("publicSite/status").set({ level: l.level, reason: l.reason, expiresAt: l.expiresAt, updatedAt: Date.now() });
}

/** Contact the Control Centre: report version/health, receive status and any renewed licence. */
export async function heartbeat(): Promise<LabLicence> {
  const url = process.env.CONTROL_CENTRE_URL;
  const before = await currentLicence();
  if (url && before.token) {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: before.token, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", domain: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "" }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.ok) {
      const { status } = (await res.json()) as { status?: string };
      const parsed = status ? verifyObject<StatusPayload>(status, pub()) : null;
      if (parsed && before.payload && parsed.labId === before.payload.labId) {
        const update: Record<string, unknown> = { statusToken: status, lastCheck: Date.now() };
        if (parsed.token && verifyObject<LicencePayload>(parsed.token, pub())) update.token = parsed.token;
        await db().doc("system/licence").set(update, { merge: true });
      }
    }
  }
  clearLicenceCache();
  const after = await currentLicence();
  await publishLicenceStatus(after);
  return after;
}
