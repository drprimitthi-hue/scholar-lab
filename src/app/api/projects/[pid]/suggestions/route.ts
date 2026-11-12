import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject } from "@/lib/server/projects";
import { suggestionSchema } from "@/lib/schemas";
import type { Suggestion } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string }> };

/** A scholar suggests a paper for the project list; the supervisor decides. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { pid } = await params;
  const input = await parseBody(req, suggestionSchema);
  const { ref, data } = await loadProject(pid);
  if (!data.scholarUids.includes(ctx.uid)) throw new HttpError(403, "Not part of this project");
  const pending = await ref.collection("suggestions").where("uid", "==", ctx.uid).where("status", "==", "pending").count().get();
  if (pending.data().count >= 20) throw new HttpError(429, "You have 20 suggestions waiting; please wait for decisions");
  const name = String((await db().doc(`scholars/${ctx.uid}`).get()).get("name") ?? "");
  const sRef = ref.collection("suggestions").doc();
  const doc: Suggestion = { id: sRef.id, uid: ctx.uid, scholarName: name, ...input, status: "pending", createdAt: Date.now() };
  const b = db().batch();
  b.set(sRef, doc);
  audit(b, ctx, "suggestion.created", "project", pid, null, { title: input.title });
  await b.commit();
  return ok({ id: sRef.id }, 201);
});
