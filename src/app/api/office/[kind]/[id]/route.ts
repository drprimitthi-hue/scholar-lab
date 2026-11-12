import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { officeKind, prepare } from "@/lib/server/office";

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function load(kind: string, id: string) {
  const k = officeKind(kind);
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, "Invalid id");
  const ref = db().doc(`${k.collection}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Not found");
  return { k, ref, data: snap.data() as Record<string, unknown> };
}

/** Replace an item with the edited version. */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { kind, id } = await params;
  const { k, ref, data } = await load(kind, id);
  const input = await parseBody(req, k.schema as never, 64 * 1024);
  const body = await prepare(ctx, k.kind, input, data);
  const b = db().batch();
  if (k.kind === "semesters" && body.active && !data.active) for (const d of (await db().collection("officeSemesters").where("active", "==", true).get()).docs) b.update(d.ref, { active: false });
  if (k.kind === "semesters") {
    // Subjects already used in the diary cannot be removed (the teaching history depends on them).
    const kept = new Set((body.subjects as { id: string }[]).map((s) => s.id));
    const removed = ((data.subjects as { id: string; name: string }[]) ?? []).filter((s) => !kept.has(s.id));
    for (const s of removed) {
      const used = await db().collection("officeDiary").where("semesterId", "==", id).where("subjectId", "==", s.id).limit(1).get();
      if (!used.empty) throw new HttpError(409, `“${s.name}” already has diary entries; keep it (you can remove its time slots)`);
    }
  }
  b.set(ref, { ...body, id, createdAt: data.createdAt, updatedAt: Date.now() });
  audit(b, ctx, `office.${k.kind}.updated`, "office", id, null, null);
  await b.commit();
  return ok();
});

export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { kind, id } = await params;
  const { k, ref } = await load(kind, id);
  if (k.kind === "semesters" && !(await db().collection("officeDiary").where("semesterId", "==", id).limit(1).get()).empty)
    throw new HttpError(409, "This semester has diary entries; it stays as teaching history");
  if (k.kind === "orders" || k.kind === "meetings") {
    const linked = await db().collection("officeDuties").where("source.id", "==", id).limit(1).get();
    if (!linked.empty) throw new HttpError(409, "A duty is linked to this; remove or re-link the duty first");
  }
  const b = db().batch();
  b.delete(ref);
  audit(b, ctx, `office.${k.kind}.deleted`, "office", id, null, null);
  await b.commit();
  return ok();
});
