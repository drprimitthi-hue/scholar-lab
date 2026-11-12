import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject, loadScholars } from "@/lib/server/projects";
import { ensureNote } from "@/lib/server/concepts";
import { conceptAssignSchema } from "@/lib/schemas";
import type { Concept } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string; cid: string }> };

/** Supervisor assigns a concept to scholars (creates their notes at "heard"). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, cid } = await params;
  if (!/^[A-Za-z0-9]{1,64}$/.test(cid)) throw new HttpError(400, "Invalid id");
  const { uids } = await parseBody(req, conceptAssignSchema);
  const { data: project } = await loadProject(pid);
  if (uids.some((u) => !project.scholarUids.includes(u))) throw new HttpError(400, "Scholar is not in this project");
  const c = await db().doc(`projects/${pid}/concepts/${cid}`).get();
  if (!c.exists) throw new HttpError(404, "Concept not found");
  let created = 0;
  for (const s of await loadScholars(uids)) if (await ensureNote(project, c.data() as Concept, s, ctx.uid)) created++;
  await db().collection("auditLog").add({ actorUid: ctx.uid, actorRole: ctx.role, action: "concept.assigned", targetType: "project", targetId: pid, before: null, after: { concept: cid, uids }, at: Date.now() });
  return ok({ created });
});
