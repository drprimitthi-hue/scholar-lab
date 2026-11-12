import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/server/admin";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { checkStorage, configureAuth, deployIndexes, deployRules, type StepResult } from "@/lib/server/provision";
import { currentLicence, publishLicenceStatus } from "@/lib/server/licence";
import { setupSchema } from "@/lib/schemas";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "@/lib/domain/defaults";

async function isDone() {
  return (await db().doc("system/setup").get()).exists;
}

/** Is first-time setup still pending? (No secrets revealed.) */
export const GET = route(async () => ok({ setupDone: await isDone(), tokenConfigured: (process.env.SETUP_TOKEN ?? "").length >= 24 }));

/** One-time setup, protected by the SETUP_TOKEN given to the person setting up this lab. Disabled once done. */
export const POST = route(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`setup:${ip}`, 5, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
  const input = await parseBody(req, setupSchema);
  const expected = process.env.SETUP_TOKEN ?? "";
  const a = Buffer.from(input.setupToken), b = Buffer.from(expected);
  if (expected.length < 24 || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(403, "The setup code is not correct.");
  if (await isDone()) throw new HttpError(409, "This lab is already set up.");

  const host = req.headers.get("host")?.split(":")[0] ?? "";
  const results: StepResult[] = [];
  results.push(await configureAuth(host));
  results.push(await deployRules());
  results.push(await deployIndexes());
  results.push(await checkStorage());

  // Supervisor account (the person running setup chooses their own password here).
  const email = input.email.toLowerCase();
  try {
    let uid: string;
    try {
      uid = (await adminAuth().getUserByEmail(email)).uid;
      await adminAuth().updateUser(uid, { password: input.password, displayName: input.name, emailVerified: true, disabled: false });
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
      uid = (await adminAuth().createUser({ email, password: input.password, displayName: input.name, emailVerified: true })).uid;
    }
    await adminAuth().setCustomUserClaims(uid, { role: "supervisor", active: true });
    await db().doc(`users/${uid}`).set({ uid, email, name: input.name, role: "supervisor", status: "active", mustChangePassword: false, createdAt: Date.now() });
    results.push({ step: "Supervisor account", ok: true, detail: `${email} created. You will set up the authenticator app at first sign-in.` });
  } catch (e) {
    results.push({ step: "Supervisor account", ok: false, detail: `Failed: ${(e as Error).message}` });
  }

  try {
    const settingsRef = db().doc("settings/lab");
    const settings = { ...DEFAULT_SETTINGS, ...((await settingsRef.get()).data() ?? {}), labName: input.labName, institution: input.institution, supervisorName: input.name };
    await settingsRef.set(settings);
    await db().doc("publicSite/info").set({ labName: settings.labName, institution: settings.institution, department: settings.department, supervisorName: settings.supervisorName, tagline: settings.tagline, accent: settings.accent });
    for (const t of DEFAULT_TEMPLATES) {
      const ref = db().doc(`milestoneTemplates/${t.programmeId}`);
      if (!(await ref.get()).exists) await ref.set(t);
    }
    results.push({ step: "Lab settings", ok: true, detail: "Default settings and milestone templates written; edit them in Settings." });
  } catch (e) {
    results.push({ step: "Lab settings", ok: false, detail: `Failed: ${(e as Error).message}` });
  }

  const critical = results.filter((r) => r.step !== "Database indexes");
  const done = critical.every((r) => r.ok);
  if (done) {
    await db().doc("system/setup").set({ doneAt: Date.now(), by: email });
    await db().collection("auditLog").add({ actorUid: "setup", actorRole: "system", action: "deployment.setup", targetType: "system", targetId: "setup", before: null, after: { email, steps: results }, at: Date.now() });
    await publishLicenceStatus(await currentLicence()).catch(() => undefined);
  }
  return ok({ done, results }, done ? 200 : 207);
});
