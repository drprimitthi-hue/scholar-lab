import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadScholars } from "@/lib/server/projects";
import { loadSession } from "@/lib/server/sessions";
import { noteIdOf } from "@/lib/server/concepts";
import { sessionRunSchema } from "@/lib/schemas";
import { masteryRank, pickSeeded } from "@/lib/domain/concepts";
import type { ConceptNote, ReadingCard, TaskDoc } from "@/lib/types";

type Ctx = { params: Promise<{ sid: string }> };

/** Running a session (supervisor or mentors chairing): attendance, questions, action items, status, spot-checks, notes. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor"] });
  const { sid } = await params;
  const input = await parseBody(req, sessionRunSchema);
  const { ref, session } = await loadSession(sid);
  const now = Date.now();
  const b = db().batch();
  switch (input.action) {
    case "attendance":
      await loadScholars(Object.keys(input.attendance));
      b.update(ref, { attendance: { ...session.attendance, ...input.attendance }, updatedAt: now });
      break;
    case "question": {
      const [by, to] = await loadScholars([input.byUid, input.toUid].filter((v, i, a) => a.indexOf(v) === i)).then((xs) => [xs.find((x) => x.uid === input.byUid), xs.find((x) => x.uid === input.toUid)]);
      if (!session.speakerUids.includes(input.toUid)) throw new HttpError(400, "Questions are recorded for a speaker");
      b.update(ref, { questions: [...session.questions, { id: randomUUID(), byUid: input.byUid, byName: by?.name ?? "", toUid: input.toUid, text: input.text, at: now }].slice(-200), updatedAt: now });
      void to;
      break;
    }
    case "action_item": {
      const [owner] = await loadScholars([input.ownerUid]);
      const tRef = db().collection("tasks").doc();
      const task: TaskDoc = { id: tRef.id, uid: owner!.uid, mentorUids: owner!.mentorUids ?? [], title: input.text, due: input.due, done: false, doneAt: null, source: { type: "session", id: sid, title: session.title }, createdBy: ctx.uid, createdAt: now };
      b.set(tRef, task);
      b.update(ref, { actionItems: [...session.actionItems, { id: randomUUID(), text: input.text, ownerUid: owner!.uid, ownerName: owner!.name, due: input.due, taskId: tRef.id }].slice(-100), updatedAt: now });
      break;
    }
    case "status": {
      b.update(ref, { status: input.status, updatedAt: now });
      // Teaching a concept in a completed session moves the speaker's accepted note to "taught".
      if (input.status === "completed" && session.type === "concept_talk") {
        for (const sp of session.speakers) {
          if (!sp.conceptId || !sp.projectId || session.attendance[sp.uid] !== "present") continue;
          const nRef = db().doc(`conceptNotes/${noteIdOf(sp.projectId, sp.uid, sp.conceptId)}`);
          const n = (await nRef.get()).data() as ConceptNote | undefined;
          if (n && n.status === "accepted" && masteryRank(n.mastery) < masteryRank("taught"))
            b.update(nRef, { mastery: "taught", updatedAt: now, history: [...n.history, { at: now, status: "taught", by: ctx.uid, comment: session.title }].slice(-30) });
        }
      }
      break;
    }
    case "spot_check": {
      const speakers = [];
      for (const sp of session.speakers) {
        const cards = (await db().collection("readingCards").where("uid", "==", sp.uid).where("status", "==", "accepted").get()).docs.map((d) => d.data() as ReadingCard);
        const pick = pickSeeded(cards, input.perSpeaker, `${sid}:${sp.uid}`).map((c) => ({ cardId: c.id, title: c.itemTitle }));
        speakers.push({ ...sp, spotCheck: pick });
      }
      b.update(ref, { speakers, updatedAt: now });
      break;
    }
    case "notes":
      b.update(ref, { notes: input.notes, updatedAt: now });
      break;
  }
  audit(b, ctx, `session.${input.action}`, "session", sid, null, input);
  await b.commit();
  return ok();
});
