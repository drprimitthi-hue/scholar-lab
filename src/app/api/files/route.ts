import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { fileInfo, readUrl } from "@/lib/server/storage";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, route } from "@/lib/server/http";
import { requireScholarAccess } from "@/lib/server/scholars";
import { canSeeOutput, fileKey } from "@/lib/server/outputs";
import { assertProjectAccess, loadProject } from "@/lib/server/projects";
import type { OutputDoc } from "@/lib/types";

async function signed(path: string): Promise<string> {
  if (!(await fileInfo(path))) throw new HttpError(404, "File not found");
  return readUrl(path, 300);
}

/** Short-lived (5 min) signed download link, issued only to users allowed to see that scholar's files. */
export const GET = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar", "alumni"], write: false });
  const path = req.nextUrl.searchParams.get("path") ?? "";
  // My Office files and bundles: only the supervisor who owns the folder.
  const office = /^office\/([A-Za-z0-9]{1,128})\/(bundles\/)?[A-Za-z0-9._-]{1,200}$/.exec(path);
  if (office) {
    if (ctx.role !== "supervisor" || office[1] !== ctx.uid) throw new HttpError(403, "Not permitted");
    return ok({ url: await signed(path) });
  }
  const m = /^scholars\/([A-Za-z0-9]{1,128})\/uploads\/[A-Za-z0-9._-]{1,200}$/.exec(path);
  if (!m) throw new HttpError(400, "Invalid path");
  try {
    await requireScholarAccess(ctx, m[1]!);
  } catch (e) {
    // Seminar slides may be opened by any lab member.
    const slides = await db().collection("sessions").where("slidePaths", "array-contains", path).limit(1).get();
    if (slides.empty) {
      // Files attached to an output or a prototype: whoever can see that record.
      const ix = await db().doc(`fileIndex/${fileKey(path)}`).get();
      if (!ix.exists || ix.get("path") !== path) throw e;
      if (ix.get("type") === "output") {
        const o = await db().doc(`outputs/${ix.get("id")}`).get();
        if (!o.exists || !(o.data() as OutputDoc).filePaths.includes(path) || !canSeeOutput(ctx, o.data() as OutputDoc)) throw e;
      } else {
        const { data: project } = await loadProject(String(ix.get("projectId")));
        assertProjectAccess(ctx, project);
        const p = await db().doc(`projects/${project.id}/prototypes/${ix.get("id")}`).get();
        if (!p.exists || !(p.get("filePaths") as string[]).includes(path)) throw e;
      }
    }
  }
  return ok({ url: await signed(path) });
});
