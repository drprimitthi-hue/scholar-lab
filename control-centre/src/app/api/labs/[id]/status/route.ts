import type { NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { statusSchema } from "@/lib/schemas";
import { loadLab } from "@/lib/server/labs";

type Ctx = { params: Promise<{ id: string }> };

/** Activate, suspend (read-only) or revoke (read-only for N days, then locked). Takes effect at the lab's next check-in (within a day). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const me = await guard(req, 15 * 60);
  const { id } = await params;
  const input = await parseBody(req, statusSchema);
  const { ref, lab } = await loadLab(id);
  const readOnlyUntil = input.status === "revoked" ? Date.now() + input.readOnlyDays * 86_400_000 : null;
  await ref.update({ status: input.status, statusMessage: input.message, readOnlyUntil, updatedAt: Date.now() });
  await audit(`lab.${input.status}`, id, me.email, { from: lab.status, message: input.message, readOnlyDays: input.readOnlyDays });
  return ok();
});
