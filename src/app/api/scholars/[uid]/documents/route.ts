import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertUpload, loadScholar } from "@/lib/server/scholars";
import { documentRegisterSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ uid: string }> };

/** Register an uploaded document against the scholar's record (supervisor or the scholar). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "scholar"] });
  const { uid } = await params;
  if (ctx.role === "scholar" && ctx.uid !== uid) throw new HttpError(403, "Not permitted");
  const input = await parseBody(req, documentRegisterSchema);
  const { ref, data } = await loadScholar(uid);
  const meta = await assertUpload(uid, input.path);
  const dRef = ref.collection("documents").doc();
  const doc = { id: dRef.id, uid, mentorUids: data.mentorUids, ...input, ...meta, uploadedBy: ctx.uid, uploadedAt: Date.now() };
  const batch = db().batch();
  batch.set(dRef, doc);
  audit(batch, ctx, "document.added", "document", `${uid}/${dRef.id}`, null, { title: input.title, category: input.category });
  await batch.commit();
  return ok({ id: dRef.id }, 201);
});
