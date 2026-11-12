import type { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";
import { heartbeat } from "@/lib/server/licence";
import { APP_VERSION } from "@/lib/version";

/** Supervisor: check the licence with the Control Centre now; also returns version info. */
export const POST = route(async (req: NextRequest) => {
  await guard(req, { roles: ["supervisor"], write: false });
  const l = await heartbeat();
  return ok({ level: l.level, reason: l.reason, expiresAt: l.expiresAt, lastCheck: l.lastCheck, labId: l.payload?.labId ?? null, version: APP_VERSION, build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", configured: l.configured });
});

export const GET = route(async (req: NextRequest) => {
  await guard(req, { roles: ["supervisor"], write: false });
  const { currentLicence } = await import("@/lib/server/licence");
  const l = await currentLicence();
  return ok({ level: l.level, reason: l.reason, expiresAt: l.expiresAt, lastCheck: l.lastCheck, labId: l.payload?.labId ?? null, version: APP_VERSION, build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", configured: l.configured });
});
