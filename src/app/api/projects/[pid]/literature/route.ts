import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject } from "@/lib/server/projects";
import { litImportSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ pid: string }> };

/** Append literature items (from a CSV parsed in the browser and validated again here). Existing ids are skipped. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid } = await params;
  const { items } = await parseBody(req, litImportSchema, 2 * 1024 * 1024);
  const { ref, data } = await loadProject(pid);
  if (data.itemCount + items.length > 5000) throw new HttpError(400, "A project can hold at most 5000 items");
  const existing = new Set((await ref.collection("literature").select().get()).docs.map((d) => d.id));
  const fresh = items.filter((i) => !existing.has(i.id));
  const now = Date.now();
  for (let i = 0; i < fresh.length; i += 400) {
    const b = db().batch();
    fresh.slice(i, i + 400).forEach((it) => b.set(ref.collection("literature").doc(it.id), { ...it, addedAt: now, source: "csv" }));
    if (i === 0) {
      b.update(ref, { itemCount: FieldValue.increment(fresh.length), updatedAt: now });
      audit(b, ctx, "literature.imported", "project", pid, null, { added: fresh.length, skipped: items.length - fresh.length });
    }
    await b.commit();
  }
  return ok({ added: fresh.length, skipped: items.length - fresh.length });
});
