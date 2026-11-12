import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";
import { syncInfo, syncPerson, syncProject } from "@/lib/server/publicSync";
import { syncOutput } from "@/lib/server/outputs";
import type { OutputDoc } from "@/lib/types";

/** Rebuild every public mirror from the private records (safe to run any time). */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  await syncInfo();
  const people = await db().collection("scholars").select().get();
  for (const d of people.docs) await syncPerson(d.id);
  // remove public entries whose source no longer exists
  for (const d of (await db().collection("publicPeople").select().get()).docs) if (!people.docs.some((p) => p.id === d.id)) await d.ref.delete();
  const projects = await db().collection("projects").select().get();
  for (const d of projects.docs) await syncProject(d.id);
  const outputs = await db().collection("outputs").get();
  for (const d of outputs.docs) await syncOutput(d.data() as OutputDoc);
  for (const d of (await db().collection("publicPublications").select().get()).docs)
    if (d.id.startsWith("out_") && !outputs.docs.some((o) => `out_${o.id}` === d.id)) await d.ref.delete();
  await db().collection("auditLog").add({ actorUid: ctx.uid, actorRole: ctx.role, action: "site.resynced", targetType: "site", targetId: "all", before: null, after: null, at: Date.now() });
  return ok({ people: people.size, projects: projects.size, outputs: outputs.size });
});
