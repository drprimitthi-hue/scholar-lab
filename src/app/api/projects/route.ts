import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadScholars, unionMentors } from "@/lib/server/projects";
import { projectCreateSchema } from "@/lib/schemas";
import type { ProjectDoc } from "@/lib/types";
import { autoNews, syncProject } from "@/lib/server/publicSync";

export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, projectCreateSchema);
  const scholars = await loadScholars(input.scholarUids);
  const ref = db().collection("projects").doc();
  const now = Date.now();
  const doc: ProjectDoc = { ...input, id: ref.id, mentorUids: unionMentors(scholars), itemCount: 0, createdAt: now, updatedAt: now };
  const b = db().batch();
  b.set(ref, doc);
  audit(b, ctx, "project.created", "project", ref.id, null, { title: input.title, scholarUids: input.scholarUids });
  await b.commit();
  await syncProject(ref.id);
  if (doc.publicVisible && doc.status !== "planned") await autoNews(`New project: ${doc.title}`, doc.publicSummary ?? "");
  return ok({ id: ref.id }, 201);
});
