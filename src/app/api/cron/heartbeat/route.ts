import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { HttpError, ok, route } from "@/lib/server/http";
import { heartbeat } from "@/lib/server/licence";

/** Daily: report to the Control Centre and refresh licence status. */
export const GET = route(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET ?? "";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (secret.length < 32 || got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, "Unauthorised");
  const l = await heartbeat();
  return ok({ level: l.level });
});
