// My Office: pure helpers (no Firebase), unit-tested.
import type { CvProfile, DiaryEntry, DutyDoc, OfficeSettings, OutputDoc, Programme, RecordDoc, ScholarDoc, SemesterDoc, Slot, Subject } from "../types";
import { daysBetween } from "./dates";

export const DEFAULT_OFFICE: OfficeSettings = {
  recordCategories: [
    "Teaching", "Journal publication", "Conference publication", "Book / chapter", "Patent", "Research project / grant", "Consultancy",
    "Award / honour", "Invited talk / lecture", "Conference / workshop attended", "Conference / workshop organised",
    "Training / FDP attended", "Training / FDP conducted", "Committee / administrative", "Examination duty",
    "Supervision", "Course / curriculum development", "Laboratory development", "Collaboration / MoU",
    "Outreach / extension", "Professional membership", "Reviewer / editorial", "Other",
  ],
  levels: ["Institute", "State", "National", "International"],
  orderTypes: ["Appointment", "Committee", "Duty / assignment", "Examination", "Event", "Additional charge", "Circular", "Other"],
  meetingTypes: ["Department", "School", "Committee", "Board of Studies", "Academic Council", "Project review", "External", "Other"],
  cvSections: [
    { id: "awards", title: "Awards and honours" },
    { id: "projects", title: "Research projects and grants" },
    { id: "publications", title: "Publications" },
    { id: "patents", title: "Patents" },
    { id: "books", title: "Books and book chapters" },
    { id: "talks", title: "Invited talks" },
    { id: "supervision", title: "Research supervision" },
    { id: "teaching", title: "Teaching" },
    { id: "courses", title: "Courses and curricula developed" },
    { id: "organised", title: "Conferences and workshops organised" },
    { id: "training", title: "Training programmes attended" },
    { id: "memberships", title: "Professional memberships" },
    { id: "editorial", title: "Editorial and reviewing" },
    { id: "admin", title: "Administrative responsibilities" },
    { id: "consultancy", title: "Consultancy" },
    { id: "outreach", title: "Outreach and extension" },
  ],
  reminderDays: [7, 2, 0],
  diaryMinutes: 60,
};

/** Sections filled automatically from the platform (in addition to records the user files under them). */
export const AUTO_SECTIONS: Record<string, string> = {
  publications: "Lab publications from the Outputs register (accepted or published)",
  patents: "Lab patents from the Outputs register (filed or later)",
  supervision: "Scholars from the platform (programme, status, years)",
  teaching: "Subjects from your semesters",
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
export const subjectLabel = (s: Pick<Subject, "code" | "name">) => (s.code ? `${s.code} ${s.name}` : s.name);
export const isTeaching = (t: string) => t === "lecture" || t === "lab" || t === "tutorial";

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const fromMin = (n: number) => { const c = Math.max(0, Math.min(23 * 60 + 59, n)); return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`; };
export const minutesBetween = (start: string, end: string) => (start && end ? Math.max(0, toMin(end) - toMin(start)) : 0);

/** Default times for a quick entry: start of the current hour, lasting `minutes`. */
export function defaultTimes(nowHHMM: string, minutes: number): { start: string; end: string } {
  const start = Math.floor(toMin(nowHHMM) / 60) * 60;
  return { start: fromMin(start), end: fromMin(start + minutes) };
}

/** The active semester: the one marked active, else one whose dates cover today. */
export function activeSemester(sems: SemesterDoc[], today: string): SemesterDoc | undefined {
  return sems.find((s) => s.active) ?? sems.find((s) => s.startDate <= today && (!s.endDate || today <= s.endDate));
}

/** Today's planned slots across the semester's subjects, earliest first. Subjects without slots are not listed here. */
export function slotsOn(sem: SemesterDoc | undefined, date: string): { subject: Subject; slot: Slot }[] {
  if (!sem) return [];
  const d = weekday(date);
  return sem.subjects.flatMap((subject) => subject.slots.filter((s) => s.day === d).map((slot) => ({ subject, slot }))).sort((a, b) => a.slot.start.localeCompare(b.slot.start));
}

/** Entries already recorded for a slot today (to show it as done). */
export const slotDone = (entries: DiaryEntry[], date: string, subjectId: string, start: string) =>
  entries.some((e) => e.date === date && e.subjectId === subjectId && Math.abs(toMin(e.start) - toMin(start)) <= 30);

export type DutyState = "done" | "dropped" | "overdue" | "today" | "soon" | "later";
/** Overdue / due today / within the reminder window / later. */
export function dutyState(d: Pick<DutyDoc, "status" | "deadline" | "remindDays">, today: string): { state: DutyState; daysLeft: number | null } {
  if (d.status !== "open") return { state: d.status, daysLeft: null };
  if (!d.deadline) return { state: "later", daysLeft: null };
  const left = daysBetween(today, d.deadline);
  if (left < 0) return { state: "overdue", daysLeft: left };
  if (left === 0) return { state: "today", daysLeft: 0 };
  return { state: left <= Math.max(0, ...d.remindDays) ? "soon" : "later", daysLeft: left };
}

export interface SubjectSummary { semesterId: string; semester: string; subjectId: string; label: string; kind: string; sessions: number; minutes: number; units: string[]; first: string; last: string }
/** Teaching summary per semester and subject, from diary entries. */
export function teachingSummary(entries: DiaryEntry[], sems: SemesterDoc[]): SubjectSummary[] {
  const out = new Map<string, SubjectSummary>();
  for (const sem of sems) for (const s of sem.subjects) out.set(`${sem.id}/${s.id}`, { semesterId: sem.id, semester: sem.name, subjectId: s.id, label: subjectLabel(s), kind: s.kind, sessions: 0, minutes: 0, units: [], first: "", last: "" });
  for (const e of entries) {
    if (!isTeaching(e.type) || !e.subjectId) continue;
    const r = out.get(`${e.semesterId}/${e.subjectId}`);
    if (!r) continue;
    r.sessions++;
    r.minutes += minutesBetween(e.start, e.end);
    if (e.unit && !r.units.includes(e.unit)) r.units.push(e.unit);
    if (!r.first || e.date < r.first) r.first = e.date;
    if (e.date > r.last) r.last = e.date;
  }
  for (const r of out.values()) r.units.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return [...out.values()];
}

export const inPeriod = (date: string, from: string, to: string) => !!date && (!from || date >= from) && (!to || date <= to);
/** A record spanning dates overlaps the period. */
export const overlaps = (start: string, end: string, from: string, to: string) => !!start && (!to || start <= to) && (!from || (end || start) >= from);

// ---------- Calendar file (.ics) so reminders arrive on the user's own phone/calendar ----------
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => { const out: string[] = []; let l = line; while (l.length > 73) { out.push(l.slice(0, 73)); l = ` ${l.slice(73)}`; } out.push(l); return out.join("\r\n"); };
export function dutyIcs(d: Pick<DutyDoc, "id" | "title" | "details" | "deadline" | "remindDays" | "assignedBy">, stamp: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) throw new Error("Duty has no deadline");
  const day = d.deadline.replace(/-/g, "");
  const next = new Date(`${d.deadline}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const ts = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Scholar Lab//My Office//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:duty-${d.id}@scholar-lab`, `DTSTAMP:${ts}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`,
    `SUMMARY:${icsText(`Deadline: ${d.title}`)}`,
    `DESCRIPTION:${icsText([d.details, d.assignedBy && `Assigned by: ${d.assignedBy}`].filter(Boolean).join("\n"))}`,
  ];
  // Reminder at 09:00 local time n days before (all-day events start at midnight; +9h).
  for (const n of [...new Set(d.remindDays)].sort((a, b) => b - a)) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(d.title)}`, `TRIGGER:${n ? `-P${n - 1}DT15H` : "PT9H"}`, "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------- CV assembly (pure) ----------

export interface CvItem { text: string; sub?: string; date: string }
export interface CvSection { id: string; title: string; items: CvItem[]; auto?: boolean }
const yr = (d: string) => d.slice(0, 4);

export function buildCv(input: {
  profile: Partial<CvProfile> | null; sections: { id: string; title: string }[]; records: RecordDoc[];
  outputs: OutputDoc[]; scholars: ScholarDoc[]; programmes: Programme[]; semesters: SemesterDoc[]; completed: string[];
}): CvSection[] {
  const hidden = new Set(input.profile?.hiddenSections ?? []);
  const out: CvSection[] = [];
  for (const s of input.sections) {
    if (hidden.has(s.id)) continue;
    const items: CvItem[] = input.records.filter((r) => r.cvSection === s.id).map((r) => ({
      text: [r.title, r.role, r.organisation, r.level].filter(Boolean).join(", ") + (r.amount ? ` (${r.amount})` : ""),
      sub: r.details.split("\n")[0]?.slice(0, 200) || undefined, date: r.date,
    }));
    let auto = false;
    if (s.id === "publications") {
      auto = true;
      for (const o of input.outputs.filter((o) => o.kind === "publication" && !o.archived && (o.status === "published" || o.status === "accepted")))
        items.push({ text: `${o.authors ? `${o.authors}. ` : ""}${o.title}. ${o.venue}${o.year ? ` (${o.year})` : ""}${o.status === "accepted" ? " [accepted]" : ""}${o.identifier ? `. ${o.identifier}` : ""}`, date: o.year ? `${o.year}-12-31` : o.date || "" });
    }
    if (s.id === "patents") {
      auto = true;
      for (const o of input.outputs.filter((o) => o.kind === "patent" && !o.archived && ["filed", "published", "examination", "granted"].includes(o.status)))
        items.push({ text: `${o.authors ? `${o.authors}. ` : ""}${o.title}. ${[o.subtype, o.identifier].filter(Boolean).join(" ")} (${o.status}${o.year ? `, ${o.year}` : ""})`, date: o.date || (o.year ? `${o.year}-12-31` : "") });
    }
    if (s.id === "supervision") {
      auto = true;
      const name = (id: string) => input.programmes.find((p) => p.id === id)?.name ?? "";
      for (const sc of input.scholars.filter((x) => !x.deletion))
        items.push({ text: `${sc.name}, ${name(sc.programmeId)}${sc.researchTopic ? `: ${sc.researchTopic}` : ""}`, sub: `${input.completed.includes(sc.status) ? "Completed" : "Ongoing"}${sc.joiningDate ? `, joined ${yr(sc.joiningDate)}` : ""}`, date: sc.joiningDate });
    }
    if (s.id === "teaching") {
      auto = true;
      for (const sem of input.semesters) if (sem.subjects.length) items.push({ text: `${sem.name}: ${sem.subjects.map((x) => `${subjectLabel(x)}${x.programme ? ` (${x.programme})` : ""}`).join("; ")}`, date: sem.startDate });
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    if (items.length) out.push({ id: s.id, title: s.title, items, auto });
  }
  return out;
}
