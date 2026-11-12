import "server-only";
import type { z } from "zod";
import { db } from "./admin";
import { fileInfo } from "./storage";
import { HttpError } from "./http";
import type { AuthContext } from "./policy";
import { DEFAULT_OFFICE, subjectLabel } from "../domain/office";
import { diarySchema, dutySchema, meetingSchema, orderSchema, recordSchema, semesterSchema } from "../schemas";
import type { FileRef, OfficeSettings, SemesterDoc } from "../types";

/** Everything in My Office is private to the supervisor (rules: supervisor-only reads; no client writes). */
export const OFFICE_KINDS = {
  diary: { collection: "officeDiary", schema: diarySchema, label: "diary entry" },
  meetings: { collection: "officeMeetings", schema: meetingSchema, label: "meeting" },
  duties: { collection: "officeDuties", schema: dutySchema, label: "duty" },
  orders: { collection: "officeOrders", schema: orderSchema, label: "office order" },
  records: { collection: "officeRecords", schema: recordSchema, label: "record" },
  semesters: { collection: "officeSemesters", schema: semesterSchema, label: "semester" },
} as const;
export type OfficeKind = keyof typeof OFFICE_KINDS;
export const OFFICE_COLLECTIONS = [...Object.values(OFFICE_KINDS).map((k) => k.collection), "officeSettings", "officeCv"];

export function officeKind(kind: string): (typeof OFFICE_KINDS)[OfficeKind] & { kind: OfficeKind } {
  if (!(kind in OFFICE_KINDS)) throw new HttpError(404, "Not found");
  return { ...OFFICE_KINDS[kind as OfficeKind], kind: kind as OfficeKind };
}

export async function getOfficeSettings(): Promise<OfficeSettings> {
  const snap = await db().doc("officeSettings/main").get();
  return { ...DEFAULT_OFFICE, ...((snap.data() as Partial<OfficeSettings> | undefined) ?? {}) };
}

/** Files must be uploaded by the supervisor into office/{uid}/. Existing files keep their metadata; new ones are verified. */
export async function checkOfficeFiles(ctx: AuthContext, incoming: FileRef[], existing: FileRef[] = []): Promise<FileRef[]> {
  const known = new Map(existing.map((f) => [f.path, f]));
  const out: FileRef[] = [];
  const seen = new Set<string>();
  for (const f of incoming) {
    if (seen.has(f.path)) continue;
    seen.add(f.path);
    const old = known.get(f.path);
    if (old) { out.push({ ...old, name: f.name }); continue; }
    if (!f.path.startsWith(`office/${ctx.uid}/`)) throw new HttpError(400, "File does not belong to you");
    const info = await fileInfo(f.path);
    if (!info) throw new HttpError(400, "Uploaded file not found");
    const type = info.contentType;
    if (type !== "application/pdf" && !/^image\/(png|jpeg|webp)$/.test(type)) throw new HttpError(400, "Only PDF or image files");
    out.push({ path: f.path, name: f.name, at: Date.now(), by: ctx.uid });
  }
  return out;
}

type Inputs = { [K in OfficeKind]: z.infer<(typeof OFFICE_KINDS)[K]["schema"]> };

/** Kind-specific checks and derived fields. Returns the document body to store. */
export async function prepare(ctx: AuthContext, kind: OfficeKind, input: Inputs[OfficeKind], existing?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { ...input };
  if ("files" in input) body.files = await checkOfficeFiles(ctx, input.files as FileRef[], (existing?.files as FileRef[]) ?? []);
  if (kind === "diary") {
    const d = input as Inputs["diary"];
    if (d.start && d.end && d.end < d.start) throw new HttpError(400, "End time is before start time");
    body.subjectLabel = "";
    if (d.subjectId) {
      if (!d.semesterId) throw new HttpError(400, "Choose the semester");
      const sem = await db().doc(`officeSemesters/${d.semesterId}`).get();
      const subject = (sem.data() as SemesterDoc | undefined)?.subjects.find((x) => x.id === d.subjectId);
      if (!subject) throw new HttpError(400, "Unknown subject");
      body.subjectLabel = subjectLabel(subject);
    }
  }
  if (kind === "duties") {
    const d = input as Inputs["duties"];
    if (d.source.type && !d.source.id) throw new HttpError(400, "Missing source");
    if (d.source.type) {
      const col = d.source.type === "order" ? "officeOrders" : "officeMeetings";
      if (!(await db().doc(`${col}/${d.source.id}`).get()).exists) throw new HttpError(400, "Linked order/meeting not found");
    }
    if (d.status === "done" && !d.doneOn) throw new HttpError(400, "Give the date it was completed");
  }
  if ((kind === "records" || kind === "orders") && "endDate" in input) {
    const r = input as Inputs["records"];
    if (r.endDate && r.endDate < r.date) throw new HttpError(400, "End date is before the start date");
  }
  if (kind === "orders") {
    const o = input as Inputs["orders"];
    if (o.validFrom && o.validTo && o.validTo < o.validFrom) throw new HttpError(400, "Valid-to is before valid-from");
  }
  if (kind === "semesters") {
    const s = input as Inputs["semesters"];
    if (s.endDate && s.endDate < s.startDate) throw new HttpError(400, "End date is before the start date");
    for (const sub of s.subjects) for (const sl of sub.slots) if (sl.start && sl.end && sl.end <= sl.start) throw new HttpError(400, `Check the times for ${sub.name}`);
  }
  return body;
}
