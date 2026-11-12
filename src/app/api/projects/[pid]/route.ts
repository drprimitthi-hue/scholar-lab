import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadProject, loadScholars, syncProjectAccess } from "@/lib/server/projects";
import { projectPatchSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";
import { autoNews, syncProject } from "@/lib/server/publicSync";

type Ctx = { params: Promise<{ pid: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid } = await params;
  const patch = await parseBody(req, projectPatchSchema);
  const { ref, data } = await loadProject(pid);
  if (patch.scholarUids) await loadScholars(patch.scholarUids);
  const diff = shallowDiff(data as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  if (!Object.keys(diff.after).length) return ok({ ok: true, changed: 0 });
  const b = db().batch();
  b.update(ref, { ...diff.after, updatedAt: Date.now() });
  audit(b, ctx, "project.updated", "project", pid, diff.before, diff.after);
  await b.commit();
  if ("scholarUids" in diff.after || "cardsVisibleToGroup" in diff.after) await syncProjectAccess(pid);
  await syncProject(pid);
  const nowPublic = (patch.publicVisible ?? data.publicVisible) && (patch.status ?? data.status) !== "planned";
  const wasPublic = data.publicVisible && data.status !== "planned";
  if (nowPublic && !wasPublic) await autoNews(`New project: ${patch.title ?? data.title}`, patch.publicSummary ?? data.publicSummary ?? "");
  return ok();
});
