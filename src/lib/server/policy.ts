// Pure authorization policy (no Firebase imports) so it can be unit-tested.
import type { Role } from "../types";

export interface TokenClaims {
  uid: string;
  email?: string;
  role?: unknown;
  active?: unknown;
  auth_time: number; // seconds
  firebase: { sign_in_second_factor?: string };
}

export interface AuthContext {
  uid: string;
  email: string;
  role: Role;
  mfa: boolean;
  authTime: number;
}

export interface GuardOptions {
  roles: Role[];
  /** Allow callers who have not completed 2FA (only for account-setup endpoints). */
  skipMfa?: boolean;
  /** false for read-only endpoints, which stay available while the licence is read-only. Default true. */
  write?: boolean;
  /** Require the session to have been established within N seconds (sensitive actions). */
  recentAuthSeconds?: number;
}

export type PolicyResult = { ok: true; ctx: AuthContext } | { ok: false; status: number; message: string };

const ROLES: Role[] = ["supervisor", "mentor", "scholar", "alumni"];
const MFA_ROLES: Role[] = ["supervisor", "mentor"];

export function evaluate(claims: TokenClaims, opts: GuardOptions, nowSec: number): PolicyResult {
  const role = claims.role as Role;
  if (!ROLES.includes(role)) return { ok: false, status: 403, message: "No role assigned" };
  if (claims.active !== true) return { ok: false, status: 403, message: "Account inactive" };
  const mfa = typeof claims.firebase?.sign_in_second_factor === "string";
  if (MFA_ROLES.includes(role) && !mfa && !opts.skipMfa) return { ok: false, status: 403, message: "Two-factor sign-in required" };
  if (!opts.roles.includes(role)) return { ok: false, status: 403, message: "Not permitted" };
  if (opts.recentAuthSeconds && nowSec - claims.auth_time > opts.recentAuthSeconds)
    return { ok: false, status: 401, message: "Please sign in again to confirm this action" };
  return { ok: true, ctx: { uid: claims.uid, email: claims.email ?? "", role, mfa, authTime: claims.auth_time } };
}

/** Can this actor see/act on records of the scholar (given that scholar's mentor list)? */
export function canAccessScholar(ctx: AuthContext, scholarUid: string, mentorUids: string[]): boolean {
  if (ctx.role === "supervisor") return true;
  if (ctx.role === "mentor") return mentorUids.includes(ctx.uid);
  return ctx.uid === scholarUid;
}
