// Progress reports: pure aggregation over records the viewer can already read. Unit-tested.
import { degreeProgress, isOverdue } from "./milestones";
import { averageScores, MASTERY } from "./concepts";
import { addDays, daysBetween, todayInTz } from "./dates";
import { stepOf } from "./outputs";
import type { ConceptNote, LeaveDoc, Milestone, OutputDoc, PresenceDoc, ReadingCard, ScoreDoc, SessionDoc, TaskDoc } from "../types";

export interface Period { from: string; to: string; tz: string }
const day = (ms: number | null | undefined, tz: string) => (ms ? todayInTz(tz, new Date(ms)) : "");
const within = (d: string, p: Period) => !!d && d >= p.from && d <= p.to;
const overlapDays = (a: string, b: string, p: Period) => { const s = a > p.from ? a : p.from; const e = b < p.to ? b : p.to; return e < s ? 0 : daysBetween(s, e) + 1; };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

export interface ScholarReport {
  degree: { progress: number; done: number; total: number; completedInPeriod: Milestone[]; overdue: Milestone[]; next: Milestone | null };
  presence: { recorded: number; present: number; absent: number; onLeave: number; rate: number | null; leaveDays: number; leaves: LeaveDoc[] };
  reading: { submitted: number; accepted: number; revise: number; pending: number; acceptance: number | null; activeDays: number };
  concepts: { acceptedInPeriod: number; mastery: Record<string, number> };
  seminars: { talks: SessionDoc[]; attended: number; held: number; attendance: number | null; score: number | null; ratings: number };
  tasks: { created: number; done: number; open: number; overdue: number };
  outputs: { list: { o: OutputDoc; moves: { at: string; to: string }[] }[] };
}

export function scholarReport(uid: string, d: {
  milestones: Milestone[]; presence: PresenceDoc[]; leaves: LeaveDoc[]; cards: ReadingCard[]; notes: ConceptNote[];
  sessions: SessionDoc[]; scores: ScoreDoc[]; tasks: TaskDoc[]; outputs: OutputDoc[];
}, p: Period, today: string): ScholarReport {
  const ms = d.milestones.filter((m) => m.uid === uid);
  const pres = d.presence.filter((x) => x.uid === uid && within(x.date, p));
  const leaves = d.leaves.filter((l) => l.uid === uid && l.status === "approved" && l.from <= p.to && l.to >= p.from);
  const cards = d.cards.filter((c) => c.uid === uid);
  const submitted = cards.filter((c) => within(day(c.submittedAt, p.tz), p));
  const reviewed = cards.filter((c) => within(day(c.reviewedAt, p.tz), p));
  const notes = d.notes.filter((n) => n.uid === uid);
  const held = d.sessions.filter((s) => s.status === "completed" && within(s.date, p));
  const recorded = held.filter((s) => s.attendance[uid]);
  const talks = held.filter((s) => s.speakerUids.includes(uid)).sort((a, b) => a.date.localeCompare(b.date));
  const talkIds = new Set(talks.map((t) => t.id));
  const scores = d.scores.filter((s) => s.uid === uid && talkIds.has(s.sessionId));
  const tasks = d.tasks.filter((t) => t.uid === uid);
  return {
    degree: {
      progress: degreeProgress(ms), done: ms.filter((m) => m.status === "approved" || m.status === "waived").length, total: ms.length,
      completedInPeriod: ms.filter((m) => m.status === "approved" && within(m.completedOn ?? "", p)),
      overdue: ms.filter((m) => isOverdue(m, today)),
      next: ms.filter((m) => m.status !== "approved" && m.status !== "waived" && m.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
    },
    presence: {
      recorded: pres.length, present: pres.filter((x) => x.status === "present").length, absent: pres.filter((x) => x.status === "absent").length,
      onLeave: pres.filter((x) => x.status === "on_leave").length,
      rate: pct(pres.filter((x) => x.status === "present").length, pres.filter((x) => x.status === "present" || x.status === "absent").length),
      leaveDays: leaves.reduce((t, l) => t + (l.from >= p.from && l.to <= p.to ? l.days : overlapDays(l.from, l.to, p)), 0), leaves,
    },
    reading: {
      submitted: submitted.length,
      accepted: reviewed.filter((c) => c.status === "accepted").length,
      revise: reviewed.filter((c) => c.status === "revise").length,
      pending: cards.filter((c) => c.status === "submitted").length,
      acceptance: pct(reviewed.filter((c) => c.status === "accepted").length, reviewed.filter((c) => c.status === "accepted" || c.status === "revise").length),
      activeDays: new Set(submitted.map((c) => day(c.submittedAt, p.tz))).size,
    },
    concepts: {
      acceptedInPeriod: notes.filter((n) => n.history.some((h) => h.status === "accepted" && within(day(h.at, p.tz), p))).length,
      mastery: Object.fromEntries(MASTERY.map((m) => [m, notes.filter((n) => n.mastery === m && (m === "heard" || n.status === "accepted")).length])),
    },
    seminars: {
      talks, held: recorded.length, attended: recorded.filter((s) => s.attendance[uid] === "present").length,
      attendance: pct(recorded.filter((s) => s.attendance[uid] === "present").length, recorded.length),
      score: scores.length ? averageScores(scores).overall : null, ratings: scores.length,
    },
    tasks: {
      created: tasks.filter((t) => within(day(t.createdAt, p.tz), p)).length,
      done: tasks.filter((t) => t.done && within(day(t.doneAt, p.tz), p)).length,
      open: tasks.filter((t) => !t.done).length,
      overdue: tasks.filter((t) => !t.done && !!t.due && t.due < today).length,
    },
    outputs: {
      list: d.outputs.filter((o) => o.memberUids.includes(uid) && !o.archived)
        .map((o) => ({ o, moves: o.history.filter((h) => within(day(h.at, p.tz), p)).map((h) => ({ at: day(h.at, p.tz), to: stepOf(o.kind, h.to)?.label ?? h.to })) }))
        .filter((x) => x.moves.length || within(day(x.o.createdAt, p.tz), p) || !stepOf(x.o.kind, x.o.status)?.terminal),
    },
  };
}

/** Lab-wide summary for a period. */
export function labReport(d: {
  scholars: { uid: string; programmeId: string; status: string; deletion: unknown }[]; milestones: Milestone[]; cards: ReadingCard[];
  sessions: SessionDoc[]; outputs: OutputDoc[]; leaves: LeaveDoc[];
}, p: Period, today: string) {
  const active = d.scholars.filter((s) => !s.deletion);
  const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => { const k = key(x) || "—"; m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const moves = d.outputs.flatMap((o) => o.history.filter((h) => within(day(h.at, p.tz), p)).map((h) => ({ o, to: h.to })));
  return {
    scholars: { total: active.length, byProgramme: count(active, (s) => s.programmeId), byStatus: count(active, (s) => s.status) },
    milestones: {
      completed: d.milestones.filter((m) => m.status === "approved" && within(m.completedOn ?? "", p)).length,
      overdue: d.milestones.filter((m) => isOverdue(m, today)).length,
      dueNext30: d.milestones.filter((m) => m.status !== "approved" && m.status !== "waived" && m.dueDate >= today && m.dueDate <= addDays(today, 30)).length,
    },
    reading: { submitted: d.cards.filter((c) => within(day(c.submittedAt, p.tz), p)).length, accepted: d.cards.filter((c) => c.status === "accepted" && within(day(c.reviewedAt, p.tz), p)).length },
    seminars: { held: d.sessions.filter((s) => s.status === "completed" && within(s.date, p)).length, talks: d.sessions.filter((s) => s.status === "completed" && within(s.date, p)).reduce((t, s) => t + s.speakerUids.length, 0) },
    outputs: {
      published: moves.filter((m) => m.o.kind === "publication" && m.to === "published").map((m) => m.o),
      accepted: moves.filter((m) => m.o.kind === "publication" && m.to === "accepted").map((m) => m.o),
      submitted: moves.filter((m) => m.o.kind === "publication" && m.to === "submitted").map((m) => m.o),
      patents: moves.filter((m) => m.o.kind === "patent" && ["filed", "granted"].includes(m.to)).map((m) => ({ o: m.o, to: m.to })),
      underReview: d.outputs.filter((o) => !o.archived && ["submitted", "under_review", "revision"].includes(o.status)).length,
    },
    leaves: { approvedDays: d.leaves.filter((l) => l.status === "approved").reduce((t, l) => t + (l.from >= p.from && l.to <= p.to ? l.days : overlapDays(l.from, l.to, p)), 0) },
  };
}
