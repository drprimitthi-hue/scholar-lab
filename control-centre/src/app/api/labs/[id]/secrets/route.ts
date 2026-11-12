import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";
import { loadLab } from "@/lib/server/labs";

type Ctx = { params: Promise<{ id: string }> };

/** Fresh one-time SETUP_TOKEN and CRON_SECRET for this lab's site. Shown once; not stored here. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const me = await guard(req, 15 * 60);
  const { id } = await params;
  await loadLab(id);
  await audit("lab.secrets_generated", id, me.email);
  return ok({ setupToken: randomBytes(24).toString("base64url"), cronSecret: randomBytes(32).toString("hex") });
});
