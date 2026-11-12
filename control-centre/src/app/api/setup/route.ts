import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminAuth, audit, db } from "@/lib/server/admin";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { setupSchema } from "@/lib/schemas";

const done = async () => (await db().doc("system/setup").get()).exists;

export const GET = route(async () => ok({ setupDone: await done(), tokenConfigured: (process.env.SETUP_TOKEN ?? "").length >= 24, keysConfigured: Boolean(process.env.LICENCE_PRIVATE_KEY && process.env.LICENCE_PUBLIC_KEY) }));

/** One-time creation of the super admin account. */
export const POST = route(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`setup:${ip}`, 5, 15 * 60_000)) throw new HttpError(429, "Too many attempts");
  const input = await parseBody(req, setupSchema);
  const want = Buffer.from(process.env.SETUP_TOKEN ?? ""), got = Buffer.from(input.setupToken);
  if (want.length < 24 || want.length !== got.length || !timingSafeEqual(want, got)) throw new HttpError(403, "The setup code is not correct.");
  if (await done()) throw new HttpError(409, "Already set up");
  const email = input.email.toLowerCase();
  try {
    await adminAuth().projectConfigManager().updateProjectConfig({
      multiFactorConfig: { state: "ENABLED", providerConfigs: [{ state: "ENABLED", totpProviderConfig: { adjacentIntervals: 5 } }] },
      emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
    });
  } catch (e) {
    throw new HttpError(400, `Enable "Firebase Authentication with Identity Platform" (Authentication → Settings → Upgrade) and email/password sign-in in the Firebase console, then retry. (${(e as Error).message})`);
  }
  let uid: string;
  try {
    uid = (await adminAuth().getUserByEmail(email)).uid;
    await adminAuth().updateUser(uid, { password: input.password, emailVerified: true });
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    uid = (await adminAuth().createUser({ email, password: input.password, emailVerified: true })).uid;
  }
  await adminAuth().setCustomUserClaims(uid, { role: "superadmin" });
  await db().doc("system/setup").set({ doneAt: Date.now(), email });
  await audit("control_centre.setup", "system", email);
  return ok({ ok: true });
});
