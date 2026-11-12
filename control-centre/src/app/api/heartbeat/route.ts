import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { heartbeatSchema } from "@/lib/schemas";
import { signObject, verifyObject, type LicencePayload, type StatusPayload } from "@/lib/licence";
import type { Lab } from "@/lib/types";

/** Called daily by each lab. Only technical data is received: licence token, app version, domain. */
export const POST = route(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`hb:${ip}`, 30)) throw new HttpError(429, "Too many requests");
  const { token, version, domain } = await parseBody(req, heartbeatSchema, 16 * 1024);
  const pub = process.env.LICENCE_PUBLIC_KEY ?? "", priv = process.env.LICENCE_PRIVATE_KEY ?? "";
  if (!pub || !priv) throw new HttpError(503, "Not configured");
  const lic = verifyObject<LicencePayload>(token, pub);
  if (!lic) throw new HttpError(401, "Invalid licence");
  const ref = db().doc(`labs/${lic.labId}`);
  const snap = await ref.get();
  const lab = snap.data() as Lab | undefined;
  const status: StatusPayload = lab
    ? {
        v: 1, labId: lic.labId, status: lab.status, readOnlyUntil: lab.readOnlyUntil, message: lab.statusMessage,
        token: lab.licence && lab.licence.iat > lic.iat ? lab.licence.token : null, at: Date.now(),
      }
    : { v: 1, labId: lic.labId, status: "unknown", readOnlyUntil: null, message: "", token: null, at: Date.now() };
  if (lab && (!lab.lastHeartbeat || Date.now() - lab.lastHeartbeat.at > 5 * 60_000))
    await ref.update({ lastHeartbeat: { at: Date.now(), version, domain } });
  return ok({ status: signObject(status, priv) });
});
