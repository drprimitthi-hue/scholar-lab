import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { listPrefix, provider, readBytes, saveBytes, selfTest, typeOfPath } from "@/lib/server/storage";

export const maxDuration = 120;

/** Which file storage this lab uses, and whether a move to Firebase Storage is possible. */
export const GET = route(async (req: NextRequest) => {
  await guard(req, { roles: ["supervisor"], write: false });
  const p = provider();
  return ok({
    provider: p,
    cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    firebaseBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
});

const body = z.strictObject({ action: z.enum(["test", "copy"]), stage: z.number().int().min(0).max(2).default(0), cursor: z.string().max(2000).default("") });
const STAGES = ["scholars/", "office/"];

/** test: round-trip check. copy: copy every file from Cloudinary into Firebase Storage at the same path,
 *  one page per call (the browser keeps calling until done). Records need no change; afterwards set
 *  FILE_STORAGE=firebase and redeploy. Evidence bundles are not copied (they are temporary). */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"], recentAuthSeconds: 30 * 60, write: false });
  const b = await parseBody(req, body);
  if (b.action === "test") return ok(await selfTest());
  if (provider() !== "cloudinary") throw new HttpError(409, "This lab already uses Firebase Storage");
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) throw new HttpError(409, "Create the Firebase Storage bucket and set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET first");
  if (b.stage >= STAGES.length) return ok({ done: true, copied: 0, stage: b.stage, cursor: "" });
  const page = await listPrefix(STAGES[b.stage]!, b.cursor, "cloudinary");
  let copied = 0;
  const failed: string[] = [];
  for (const f of page.files) {
    if (/\/bundles\//.test(f.path)) continue;
    try { await saveBytes(f.path, await readBytes(f.path, "cloudinary"), typeOfPath(f.path), "firebase"); copied++; } catch { failed.push(f.path); }
  }
  const next = page.next ? { stage: b.stage, cursor: page.next } : { stage: b.stage + 1, cursor: "" };
  if (failed.length || copied) await db().collection("auditLog").add({ actorUid: ctx.uid, actorRole: ctx.role, action: "system.files_copied", targetType: "system", targetId: "storage", before: null, after: { copied, failed: failed.length }, at: Date.now() });
  return ok({ done: next.stage >= STAGES.length, copied, failed, ...next });
});
