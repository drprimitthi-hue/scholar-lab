import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";

export const GET = route(async (req: NextRequest) => {
  await guard(req);
  const snap = await db().collection("auditLog").orderBy("at", "desc").limit(500).get();
  return ok({ entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
});
