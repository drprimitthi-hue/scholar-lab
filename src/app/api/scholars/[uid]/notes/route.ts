import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { notesSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ uid: string }> };

/** Private supervisor notes (stored separately; never readable by the scholar or mentors). */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const { notes } = await parseBody(req, notesSchema);
  await loadScholar(uid);
  const ref = db().doc(`scholarNotes/${uid}`);
  const before = (await ref.get()).get("notes") ?? null;
  const batch = db().batch();
  batch.set(ref, { notes, updatedAt: Date.now() });
  audit(batch, ctx, "scholar.notes.updated", "scholar", uid, { notes: before }, { notes });
  await batch.commit();
  return ok();
});
