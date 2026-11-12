import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertUpload } from "@/lib/server/scholars";
import { loadSession, speakerFields } from "@/lib/server/sessions";
import { slidesSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ sid: string }> };

/** A speaker attaches their slides (PDF) to the session; lab members can then open them. */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { sid } = await params;
  const { path } = await parseBody(req, slidesSchema);
  const { ref, session } = await loadSession(sid);
  if (!session.speakerUids.includes(ctx.uid)) throw new HttpError(403, "You are not a speaker in this session");
  if (session.status !== "scheduled") throw new HttpError(409, "This session is closed");
  const meta = await assertUpload(ctx.uid, path);
  if (meta.contentType !== "application/pdf") throw new HttpError(400, "Slides must be a PDF");
  const speakers = session.speakers.map((s) => (s.uid === ctx.uid ? { ...s, slidesPath: path, slidesAt: Date.now() } : s));
  const b = db().batch();
  b.update(ref, { ...speakerFields(speakers), updatedAt: Date.now() });
  audit(b, ctx, "session.slides_uploaded", "session", sid);
  await b.commit();
  return ok();
});
