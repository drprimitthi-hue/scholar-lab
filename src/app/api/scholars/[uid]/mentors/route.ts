import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { assertMentors, loadScholar, SCHOLAR_SCOPED_COLLECTIONS, SCHOLAR_SUBCOLLECTIONS } from "@/lib/server/scholars";
import { mentorsSchema } from "@/lib/schemas";
import { syncProjectsOfScholar } from "@/lib/server/projects";
import { syncOutputsOfScholar } from "@/lib/server/outputs";

type Ctx = { params: Promise<{ uid: string }> };

/** Assign mentors and propagate the access list to every record of this scholar. */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const { mentorUids } = await parseBody(req, mentorsSchema);
  await assertMentors(mentorUids);
  const { ref, data } = await loadScholar(uid);

  const refs = [ref];
  for (const c of SCHOLAR_SCOPED_COLLECTIONS) {
    const snap = await db().collection(c).where("uid", "==", uid).select().get();
    refs.push(...snap.docs.map((d) => d.ref));
  }
  for (const c of SCHOLAR_SUBCOLLECTIONS) {
    const snap = await ref.collection(c).select().get();
    refs.push(...snap.docs.map((d) => d.ref));
  }
  // Commit in chunks (Firestore batch limit 500); audit goes with the first chunk.
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db().batch();
    for (const r of refs.slice(i, i + 400)) batch.update(r, { mentorUids });
    if (i === 0) audit(batch, ctx, "scholar.mentors.updated", "scholar", uid, { mentorUids: data.mentorUids }, { mentorUids });
    await batch.commit();
  }
  await syncProjectsOfScholar(uid);
  await syncOutputsOfScholar(uid);
  return ok();
});
