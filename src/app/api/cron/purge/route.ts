import { timingSafeEqual, createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/server/admin";
import { deleteFiles, deletePrefix, listPrefix } from "@/lib/server/storage";
import { audit } from "@/lib/server/audit";
import { HttpError, ok, route } from "@/lib/server/http";
import { SCHOLAR_SCOPED_COLLECTIONS, SCHOLAR_SUBCOLLECTIONS } from "@/lib/server/scholars";
import { removeScholarFromProjects } from "@/lib/server/projects";
import { removeScholarFromOutputs } from "@/lib/server/outputs";
import type { ScholarDoc, SessionDoc } from "@/lib/types";

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function deleteQuery(refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = db().batch();
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

/** Daily job: permanently purge scholars whose 7-day deletion grace period has ended. */
export const GET = route(async (req: NextRequest) => {
  if (!authorised(req)) throw new HttpError(401, "Unauthorised");
  const due = await db().collection("scholars").where("deletion.purgeAfter", "<=", Date.now()).limit(10).get();
  const purged: string[] = [];

  for (const docSnap of due.docs) {
    const s = docSnap.data() as ScholarDoc;
    const uid = s.uid;
    const alias = `deleted-${createHash("sha256").update(uid).digest("hex").slice(0, 10)}`;

    // 1. Files
    await deletePrefix(`scholars/${uid}/`).catch(() => undefined);
    // 2. Records
    const refs: FirebaseFirestore.DocumentReference[] = [];
    for (const c of SCHOLAR_SUBCOLLECTIONS) refs.push(...(await docSnap.ref.collection(c).select().get()).docs.map((d) => d.ref));
    for (const c of SCHOLAR_SCOPED_COLLECTIONS)
      refs.push(...(await db().collection(c).where("uid", "==", uid).select().get()).docs.map((d) => d.ref));
    await deleteQuery(refs);
    await db().doc(`publicPeople/${uid}`).delete();
    // Group seminar records stay, without identifying the person.
    for (const sDoc of (await db().collection("sessions").where("speakerUids", "array-contains", uid).get()).docs) {
      const sd = sDoc.data() as SessionDoc;
      await sDoc.ref.update({
        speakers: sd.speakers.map((sp) => (sp.uid === uid ? { ...sp, uid: alias, name: "Former member", slidesPath: "", spotCheck: [] } : sp)),
        speakerUids: sd.speakerUids.map((u) => (u === uid ? alias : u)),
        slidePaths: sd.slidePaths.filter((p) => !p.startsWith(`scholars/${uid}/`)),
      });
    }
    for (const sDoc of (await db().collection("sessions").where(`attendance.${uid}`, "in", ["present", "absent", "excused"]).get()).docs) {
      const sd = sDoc.data() as SessionDoc;
      const attendance = { ...sd.attendance };
      delete attendance[uid];
      await sDoc.ref.update({
        attendance,
        questions: sd.questions.map((q) => ({ ...q, byUid: q.byUid === uid ? alias : q.byUid, byName: q.byUid === uid ? "Former member" : q.byName, toUid: q.toUid === uid ? alias : q.toUid })),
        actionItems: sd.actionItems.map((a) => (a.ownerUid === uid ? { ...a, ownerUid: alias, ownerName: "Former member" } : a)),
      });
    }
    await removeScholarFromOutputs(uid, alias);
    const projectRecords = await removeScholarFromProjects(uid);
    // 3. Anonymise audit entries (the log is kept for integrity, without identifying the person)
    for (const field of ["targetId", "actorUid"] as const) {
      const snap = await db().collection("auditLog").where(field, ">=", uid).where(field, "<=", uid + "").get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = db().batch();
        snap.docs.slice(i, i + 400).forEach((d) => {
          const v = d.get(field) as string;
          b.update(d.ref, { [field]: v.replace(uid, alias), before: null, after: null });
        });
        await b.commit();
      }
    }
    // 4. Minimal supervision record (optional) + receipt, then the profile itself
    const b = db().batch();
    if (s.deletion?.keepMinimal)
      b.set(db().doc(`supervisionRecords/${alias}`), {
        name: s.name, programmeId: s.programmeId, joiningDate: s.joiningDate,
        researchTopic: s.researchTopic, status: s.status, recordedAt: Date.now(),
      });
    b.set(db().collection("deletionReceipts").doc(), {
      alias,
      name: s.deletion?.keepMinimal ? s.name : null,
      scheduledAt: s.deletion?.scheduledAt ?? null,
      purgedAt: Date.now(),
      recordsDeleted: refs.length + projectRecords + 2,
      kept: s.deletion?.keepMinimal ? "Minimal supervision record" : "Nothing (full erasure)",
      backupsExpireBy: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    b.delete(db().doc(`scholarNotes/${uid}`));
    b.delete(docSnap.ref);
    b.delete(db().doc(`users/${uid}`));
    audit(b, { uid: "system", role: "system" }, "scholar.purged", "scholar", alias);
    await b.commit();
    await adminAuth().deleteUser(uid).catch(() => undefined);
    purged.push(alias);
  }
  // Evidence bundles are generated copies; keep them 7 days (the originals stay).
  let bundles = 0;
  try {
    let cursor = "";
    do {
      const page = await listPrefix("office/", cursor);
      const old = page.files.filter((f) => /^office\/[A-Za-z0-9]+\/bundles\//.test(f.path) && Date.now() - f.created > 7 * 86_400_000).map((f) => f.path);
      await deleteFiles(old);
      bundles += old.length;
      cursor = page.next;
    } while (cursor);
  } catch { /* storage not reachable today; try again tomorrow */ }
  return ok({ purged, bundles });
});
