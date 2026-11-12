import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, route } from "@/lib/server/http";
import { loadProject } from "@/lib/server/projects";

type Ctx = { params: Promise<{ pid: string; lid: string }> };

/** Remove an item that nobody has started (records are never deleted once a scholar has worked on them). */
export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, lid } = await params;
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(lid)) throw new HttpError(400, "Invalid id");
  const { ref } = await loadProject(pid);
  const item = await ref.collection("literature").doc(lid).get();
  if (!item.exists) throw new HttpError(404, "Item not found");
  const used = await db().collection("readingCards").where("projectId", "==", pid).where("itemId", "==", lid).limit(1).get();
  if (!used.empty) throw new HttpError(409, "A scholar has already worked on this item; it cannot be removed");
  const plans = await ref.collection("plans").get();
  const b = db().batch();
  b.delete(item.ref);
  b.update(ref, { itemCount: FieldValue.increment(-1), updatedAt: Date.now() });
  for (const p of plans.docs) {
    const batches = (p.get("batches") as { no: number; date: string; itemIds: string[] }[]).map((x) => ({ ...x, itemIds: x.itemIds.filter((i) => i !== lid) }));
    b.update(p.ref, { batches });
  }
  audit(b, ctx, "literature.removed", "project", pid, item.data(), null);
  await b.commit();
  return ok();
});
