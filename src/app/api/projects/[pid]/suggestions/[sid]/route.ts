import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject } from "@/lib/server/projects";
import { suggestionDecisionSchema } from "@/lib/schemas";
import type { LitItem, Suggestion } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string; sid: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, sid } = await params;
  if (!/^[A-Za-z0-9]{1,64}$/.test(sid)) throw new HttpError(400, "Invalid id");
  const input = await parseBody(req, suggestionDecisionSchema);
  const { ref } = await loadProject(pid);
  const sRef = ref.collection("suggestions").doc(sid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(sRef);
    if (!snap.exists) throw new HttpError(404, "Suggestion not found");
    const s = snap.data() as Suggestion;
    if (s.status !== "pending") throw new HttpError(409, "Already decided");
    if (input.action === "approve") {
      const item: LitItem = {
        id: `S${sid.slice(0, 20)}`, title: s.title, authors: "", year: "", venue: "", url: s.url,
        type: input.type ?? "primary", priority: input.priority ?? "supporting", theme: input.theme || "Suggested",
        estMinutes: input.estMinutes ?? 30, orderHint: Date.now(), addedAt: Date.now(), source: "suggestion",
      };
      tx.set(ref.collection("literature").doc(item.id), item);
      tx.update(ref, { itemCount: FieldValue.increment(1), updatedAt: Date.now() });
    }
    tx.update(sRef, { status: input.action === "approve" ? "approved" : "rejected" });
    audit(tx, ctx, `suggestion.${input.action}d`, "project", pid, null, { title: s.title });
  });
  return ok();
});
