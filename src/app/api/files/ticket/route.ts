import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { maxFileBytes, uploadTicket } from "@/lib/server/storage";

const schema = z.strictObject({
  scope: z.enum(["scholar", "office"]),
  uid: z.string().regex(/^[A-Za-z0-9]{1,128}$/),
  contentType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
  size: z.number().int().positive(),
});
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Permission to upload ONE file. The server chooses the exact path; the signature (Cloudinary) or the
 *  storage rules (Firebase) only allow that path. Scholars: own folder. Supervisor: a scholar's folder or own office. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "scholar"] });
  if (!rateLimit(`ticket:${ctx.uid}`, 60, 60_000)) throw new HttpError(429, "Too many uploads; wait a minute");
  const t = await parseBody(req, schema);
  if (t.size > maxFileBytes()) throw new HttpError(400, "File is larger than 10 MB");
  if (t.scope === "office") {
    if (ctx.role !== "supervisor" || t.uid !== ctx.uid) throw new HttpError(403, "Not permitted");
  } else if (ctx.role === "scholar") {
    if (t.uid !== ctx.uid) throw new HttpError(403, "You can only upload to your own folder");
  } else if (!(await db().doc(`scholars/${t.uid}`).get()).exists) throw new HttpError(404, "Scholar not found");
  const name = `${Date.now()}-${randomUUID()}.${EXT[t.contentType]}`;
  const path = t.scope === "office" ? `office/${t.uid}/${name}` : `scholars/${t.uid}/uploads/${name}`;
  return ok(uploadTicket(path, t.contentType));
});
