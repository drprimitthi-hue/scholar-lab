import type { NextRequest } from "next/server";
import { audit, db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { labCreateSchema } from "@/lib/schemas";
import type { Lab } from "@/lib/types";

export const GET = route(async (req: NextRequest) => {
  await guard(req);
  const snap = await db().collection("labs").get();
  return ok({ labs: snap.docs.map((d) => d.data() as Lab).map(({ licence, ...l }) => ({ ...l, licence: licence ? { ...licence, token: "" } : null })) });
});

export const POST = route(async (req: NextRequest) => {
  const me = await guard(req);
  const input = await parseBody(req, labCreateSchema);
  const ref = db().doc(`labs/${input.id}`);
  if ((await ref.get()).exists) throw new HttpError(409, "A lab with this id already exists");
  const now = Date.now();
  const lab: Lab = { ...input, status: "active", statusMessage: "", readOnlyUntil: null, licence: null, lastHeartbeat: null, createdAt: now, updatedAt: now };
  await ref.set(lab);
  await audit("lab.created", input.id, me.email, { labName: input.labName, faculty: input.faculty.name });
  return ok({ id: input.id }, 201);
});
