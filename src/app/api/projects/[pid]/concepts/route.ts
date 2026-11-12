import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadProject } from "@/lib/server/projects";
import { validateConcept } from "@/lib/server/concepts";
import { conceptSchema } from "@/lib/schemas";
import type { Concept } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string }> };


export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid } = await params;
  const input = await parseBody(req, conceptSchema);
  await loadProject(pid);
  const ref = db().collection(`projects/${pid}/concepts`).doc();
  const all = await validateConcept(pid, ref.id, input);
  const concept: Concept = { ...input, id: ref.id, order: all.length, createdAt: Date.now() };
  const b = db().batch();
  b.set(ref, concept);
  audit(b, ctx, "concept.created", "project", pid, null, { title: input.title });
  await b.commit();
  return ok({ id: ref.id }, 201);
});
