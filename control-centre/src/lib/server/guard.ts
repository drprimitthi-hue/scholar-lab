import "server-only";
import type { NextRequest } from "next/server";
import { adminAuth } from "./admin";
import { HttpError } from "./http";
import { rateLimit } from "./rateLimit";

export interface Admin { uid: string; email: string }

/** Only the super admin, signed in with 2FA. Optionally require a fresh sign-in. */
export async function guard(req: NextRequest, recentAuthSeconds?: number): Promise<Admin> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token || token.length > 4096) throw new HttpError(401, "Not signed in");
  const auth = adminAuth();
  let d: Record<string, unknown> & { uid: string; auth_time: number; firebase: { sign_in_second_factor?: string } };
  try {
    d = (await auth.verifyIdToken(token, true)) as typeof d;
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }
  if (!rateLimit(`u:${d.uid}`, 120)) throw new HttpError(429, "Too many requests");
  if (d.role !== "superadmin") throw new HttpError(403, "Not permitted");
  if (!d.firebase?.sign_in_second_factor) throw new HttpError(403, "Two-factor sign-in required");
  if (recentAuthSeconds && Date.now() / 1000 - d.auth_time > recentAuthSeconds) throw new HttpError(401, "Please sign in again to confirm this action");
  return { uid: d.uid, email: String(d.email ?? "") };
}
