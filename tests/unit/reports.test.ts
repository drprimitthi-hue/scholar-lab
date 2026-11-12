import { describe, expect, it } from "vitest";
import { labReport, scholarReport } from "@/lib/domain/reports";

const P = { from: "2026-04-01", to: "2026-06-30", tz: "UTC" };
const T = "2026-07-01";
const ms = (o: object) => ({ id: "m", uid: "A", mentorUids: [], title: "M", weight: 1, order: 0, dueDate: "2026-12-01", status: "not_started", completedOn: null, scholarNote: "", remarks: "", approvedBy: null, evidence: [], updatedAt: 0, ...o });
const ts = (d: string) => Date.parse(`${d}T10:00:00Z`);
const card = (o: object) => ({ id: "c", uid: "A", projectId: "P", status: "accepted", submittedAt: ts("2026-05-01"), reviewedAt: ts("2026-05-02"), ...o });
const sess = (o: object) => ({ id: "s", date: "2026-05-10", status: "completed", speakerUids: [], attendance: {}, ...o });

describe("scholar report", () => {
  const r = scholarReport("A", {
    milestones: [ms({ status: "approved", completedOn: "2026-05-05", weight: 1 }), ms({ id: "m2", dueDate: "2026-06-01" }), ms({ id: "m3", uid: "B", status: "approved", completedOn: "2026-05-05" })] as never,
    presence: [{ uid: "A", date: "2026-05-01", status: "present" }, { uid: "A", date: "2026-05-02", status: "absent" }, { uid: "A", date: "2026-05-03", status: "on_leave" }, { uid: "A", date: "2026-03-01", status: "present" }] as never,
    leaves: [{ uid: "A", status: "approved", from: "2026-05-03", to: "2026-05-04", days: 2 }, { uid: "A", status: "approved", from: "2026-06-29", to: "2026-07-05", days: 7 }, { uid: "A", status: "rejected", from: "2026-05-10", to: "2026-05-10", days: 1 }] as never,
    cards: [card({}), card({ id: "c2", status: "revise" }), card({ id: "c3", status: "submitted", reviewedAt: null }), card({ id: "c4", submittedAt: ts("2026-03-01"), reviewedAt: ts("2026-03-02") })] as never,
    notes: [{ uid: "A", status: "accepted", mastery: "explained", history: [{ at: ts("2026-05-20"), status: "accepted", by: "s" }] }, { uid: "A", status: "draft", mastery: "heard", history: [] }] as never,
    sessions: [sess({ id: "s1", speakerUids: ["A"], attendance: { A: "present" } }), sess({ id: "s2", attendance: { A: "absent" } }), sess({ id: "s3", attendance: {} }), sess({ id: "s4", date: "2026-08-01", attendance: { A: "present" } })] as never,
    scores: [{ uid: "A", sessionId: "s1", scores: { clarity: 4, depth: 4, critical: 4, qa: 4 } }, { uid: "A", sessionId: "s1", scores: { clarity: 2, depth: 2, critical: 2, qa: 2 } }] as never,
    tasks: [{ uid: "A", done: false, due: "2026-06-01", createdAt: ts("2026-05-01"), doneAt: null }, { uid: "A", done: true, due: "", createdAt: ts("2026-05-01"), doneAt: ts("2026-05-02") }] as never,
    outputs: [{ id: "o", kind: "publication", memberUids: ["A"], archived: false, status: "submitted", createdAt: ts("2026-01-01"), history: [{ at: ts("2026-05-15"), to: "submitted" }] }, { id: "o2", kind: "publication", memberUids: ["A"], archived: false, status: "published", createdAt: ts("2025-01-01"), history: [] }] as never,
  }, P, T);
  it("degree", () => {
    expect(r.degree).toMatchObject({ progress: 50, done: 1, total: 2 });
    expect(r.degree.completedInPeriod).toHaveLength(1);
    expect(r.degree.overdue.map((m) => m.id)).toEqual(["m2"]);
  });
  it("presence and leave (partial overlap counted by days inside the period)", () => {
    expect(r.presence).toMatchObject({ recorded: 3, present: 1, absent: 1, onLeave: 1, rate: 50, leaveDays: 4 });
  });
  it("reading", () => expect(r.reading).toMatchObject({ submitted: 3, accepted: 1, revise: 1, pending: 1, acceptance: 50, activeDays: 1 }));
  it("concepts", () => expect(r.concepts).toMatchObject({ acceptedInPeriod: 1, mastery: { heard: 1, explained: 1, applied: 0, taught: 0 } }));
  it("seminars", () => expect(r.seminars).toMatchObject({ held: 2, attended: 1, attendance: 50, score: 3, ratings: 2 }));
  it("tasks", () => expect(r.tasks).toEqual({ created: 2, done: 1, open: 1, overdue: 1 }));
  it("outputs: moved in period or still in progress; finished ones without activity are left out", () => {
    expect(r.outputs.list.map((x) => x.o.id)).toEqual(["o"]);
    expect(r.outputs.list[0]!.moves).toEqual([{ at: "2026-05-15", to: "Submitted" }]);
  });
});

describe("lab report", () => {
  it("summarises", () => {
    const r = labReport({
      scholars: [{ uid: "A", programmeId: "phd", status: "Coursework", deletion: null }, { uid: "B", programmeId: "phd", status: "Coursework", deletion: null }, { uid: "C", programmeId: "mtech", status: "x", deletion: {} }],
      milestones: [ms({ status: "approved", completedOn: "2026-05-05" }), ms({ dueDate: "2026-06-01" }), ms({ dueDate: "2026-07-20" })] as never,
      cards: [card({}), card({ status: "submitted", reviewedAt: null })] as never,
      sessions: [sess({ speakerUids: ["A", "B"] }), sess({ status: "cancelled" })] as never,
      outputs: [{ kind: "publication", archived: false, status: "published", history: [{ at: ts("2026-06-01"), to: "published" }] }, { kind: "patent", archived: false, status: "filed", history: [{ at: ts("2026-04-02"), to: "filed" }] }, { kind: "publication", archived: false, status: "under_review", history: [] }] as never,
      leaves: [{ status: "approved", from: "2026-05-01", to: "2026-05-02", days: 2 }] as never,
    }, P, T);
    expect(r.scholars).toEqual({ total: 2, byProgramme: { phd: 2 }, byStatus: { Coursework: 2 } });
    expect(r.milestones).toEqual({ completed: 1, overdue: 1, dueNext30: 1 });
    expect(r.reading).toEqual({ submitted: 2, accepted: 1 });
    expect(r.seminars).toEqual({ held: 1, talks: 2 });
    expect(r.outputs.published).toHaveLength(1);
    expect(r.outputs.patents[0]!.to).toBe("filed");
    expect(r.outputs.underReview).toBe(1);
    expect(r.leaves.approvedDays).toBe(2);
  });
});
