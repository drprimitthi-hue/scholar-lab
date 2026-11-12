import type { NextRequest } from "next/server";
import { audit, db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadLab } from "@/lib/server/labs";
import { labSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req: NextRequest, { params }) => {
  await guard(req);
  const { lab } = await loadLab((await params).id);
  const history = await db().collection("auditLog").where("target", "==", lab.id).get();
  return ok({ lab, history: history.docs.map((d) => d.data()).sort((a, b) => b.at - a.at).slice(0, 100) });
});

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const me = await guard(req);
  const { id } = await params;
  const input = await parseBody(req, labSchema);
  const { ref } = await loadLab(id);
  await ref.update({ ...input, updatedAt: Date.now() });
  await audit("lab.updated", id, me.email);
  return ok();
});
