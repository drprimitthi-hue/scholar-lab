import "server-only";
import type { NextRequest } from "next/server";
import { adminAuth, appCheck } from "./admin";
import { HttpError } from "./http";
import { evaluate, type AuthContext, type GuardOptions, type TokenClaims } from "./policy";
import { rateLimit } from "./rateLimit";
import { currentLicence } from "./licence";

export type { AuthContext };

/** Verify the caller's Firebase ID token (revocation-checked), App Check (if enforced), role and 2FA. */
export async function guard(req: NextRequest, opts: GuardOptions): Promise<AuthContext> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > 4096) throw new HttpError(401, "Not signed in");

  if (process.env.APP_CHECK_ENFORCE === "true") {
    const ac = req.headers.get("x-firebase-appcheck");
    if (!ac) throw new HttpError(401, "App verification failed");
    try {
      await appCheck().verifyToken(ac);
    } catch {
      throw new HttpError(401, "App verification failed");
    }
  }

  const auth = adminAuth(); // configuration errors surface as 500, not as "signed out"
  let decoded: TokenClaims;
  try {
    decoded = (await auth.verifyIdToken(token, true)) as unknown as TokenClaims;
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }

  if (!rateLimit(`u:${decoded.uid}`, 120)) throw new HttpError(429, "Too many requests. Please slow down.");

  const result = evaluate(decoded, opts, Math.floor(Date.now() / 1000));
  if (!result.ok) throw new HttpError(result.status, result.message);

  const lic = await currentLicence();
  if (lic.level === "locked") throw new HttpError(423, lic.reason || "This lab's licence is not active.");
  if (lic.level === "readonly" && opts.write !== false) throw new HttpError(423, `Read-only: ${lic.reason}`);
  return result.ctx;
}
