import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { assertPrototypeWorker, checkFiles, indexFiles, loadPrototype } from "@/lib/server/outputs";
import { logEntrySchema } from "@/lib/schemas";
import { addDays, todayInTz } from "@/lib/domain/dates";
import type { LogEntry } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string; id: string }> };

/** Append a logbook entry. Entries are permanent (no edit, no delete); back-dating is limited to 7 days. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { pid, id } = await params;
  const input = await parseBody(req, logEntrySchema);
  const { ref, data, project } = await loadPrototype(pid, id);
  assertPrototypeWorker(ctx, data, project);
  const today = todayInTz((await getSettings()).timezone);
  if (input.date > today || input.date < addDays(today, -7)) throw new HttpError(400, "Date must be within the last 7 days");
  const files = await checkFiles(ctx, input.files);
  const user = await db().doc(`users/${ctx.uid}`).get();
  const eref = ref.collection("log").doc();
  const e: LogEntry = { id: eref.id, date: input.date, uid: ctx.uid, name: String(user.get("name") ?? ""), text: input.text, hours: input.hours, files, at: Date.now() };
  const b = db().batch();
  b.set(eref, e);
  if (files.length) b.update(ref, { filePaths: [...data.filePaths, ...files.map((f) => f.path)], updatedAt: Date.now() });
  indexFiles(b, files, { type: "prototype", projectId: pid, id });
  audit(b, ctx, "prototype.log_added", "prototype", `${pid}/${id}`, null, { date: e.date, hours: e.hours });
  await b.commit();
  return ok({ id: eref.id }, 201);
});
