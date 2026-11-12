import type { NextRequest } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { db } from "@/lib/server/admin";
import { OFFICE_COLLECTIONS } from "@/lib/server/office";
import { guard } from "@/lib/server/guard";
import { route } from "@/lib/server/http";

// Top-level collections; sub-collections (milestones, literature, plans, concepts, prototypes, logbooks…) are walked automatically.
const TOP = [
  "settings", "system", "users", "scholars", "scholarNotes", "milestoneTemplates", "presence", "leaves", "projects",
  "readingCards", "suggestions", "conceptNotes", "sessions", "sessionScores", "tasks", "outputs",
  "siteContent", "siteNews", "siteOpenings", "sitePublications",
  ...OFFICE_COLLECTIONS, "supervisionRecords", "deletionReceipts", "auditLog",
];

/** Supervisor: download every record of this lab as JSON lines (also allowed while read-only). Files are listed by path. */
export const GET = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"], write: false, recentAuthSeconds: 30 * 60 });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      write({ type: "meta", exportedAt: new Date().toISOString(), by: ctx.uid });
      const walk = async (ref: DocumentReference, data: unknown) => {
        write({ path: ref.path, data });
        for (const sub of await ref.listCollections()) for (const d of (await sub.get()).docs) await walk(d.ref, d.data());
      };
      try {
        for (const c of TOP) for (const d of (await db().collection(c).get()).docs) await walk(d.ref, d.data());
        await db().collection("auditLog").add({ actorUid: ctx.uid, actorRole: ctx.role, action: "data.exported", targetType: "system", targetId: "export", before: null, after: null, at: Date.now() });
      } catch (e) {
        write({ type: "error", message: (e as Error).message });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="lab-export-${new Date().toISOString().slice(0, 10)}.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
});
