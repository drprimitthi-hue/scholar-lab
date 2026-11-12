import { describe, expect, it } from "vitest";
import { activeSemester, defaultTimes, dutyIcs, dutyState, minutesBetween, overlaps, slotDone, slotsOn, teachingSummary, weekday } from "@/lib/domain/office";
import type { DiaryEntry, SemesterDoc } from "@/lib/types";

const sem = (over: Partial<SemesterDoc> = {}): SemesterDoc => ({
  id: "S1", name: "Odd 2026", startDate: "2026-07-15", endDate: "2026-12-15", active: false, createdAt: 0, updatedAt: 0,
  subjects: [
    { id: "a", code: "HS101", name: "Hardware Security", programme: "M.Tech", kind: "theory", units: 5, slots: [{ day: 3, start: "10:00", end: "11:00", room: "201" }, { day: 1, start: "09:00", end: "10:00", room: "201" }] },
    { id: "b", code: "", name: "IoT Lab", programme: "M.Sc", kind: "lab", units: 0, slots: [{ day: 3, start: "09:00", end: "11:00", room: "Lab 2" }] },
    { id: "c", code: "X", name: "No slots", programme: "", kind: "theory", units: 4, slots: [] },
  ], ...over,
});
const entry = (o: Partial<DiaryEntry>): DiaryEntry => ({ id: "e", date: "2026-11-11", start: "10:00", end: "11:00", type: "lecture", semesterId: "S1", subjectId: "a", subjectLabel: "", room: "", unit: "", topic: "", remark: "", students: 0, createdAt: 0, updatedAt: 0, ...o });

describe("office: semesters & diary", () => {
  it("weekday and slots for today, earliest first", () => {
    expect(weekday("2026-11-11")).toBe(3); // Wednesday
    const s = slotsOn(sem(), "2026-11-11");
    expect(s.map((x) => x.subject.id)).toEqual(["b", "a"]);
    expect(slotsOn(sem(), "2026-11-12")).toEqual([]);
  });
  it("active semester: flag first, else dates", () => {
    expect(activeSemester([sem({ id: "old", startDate: "2026-01-01", endDate: "2026-05-30" }), sem()], "2026-11-11")?.id).toBe("S1");
    expect(activeSemester([sem(), sem({ id: "flag", active: true, startDate: "2027-01-01" })], "2026-11-11")?.id).toBe("flag");
    expect(activeSemester([sem()], "2027-03-01")).toBeUndefined();
  });
  it("default times round to the hour and clamp", () => {
    expect(defaultTimes("10:42", 60)).toEqual({ start: "10:00", end: "11:00" });
    expect(defaultTimes("23:30", 90)).toEqual({ start: "23:00", end: "23:59" });
    expect(minutesBetween("09:00", "10:30")).toBe(90);
    expect(minutesBetween("", "10:30")).toBe(0);
  });
  it("slot done within 30 minutes", () => {
    expect(slotDone([entry({ start: "10:20" })], "2026-11-11", "a", "10:00")).toBe(true);
    expect(slotDone([entry({ start: "11:00" })], "2026-11-11", "a", "10:00")).toBe(false);
  });
  it("teaching summary counts sessions, hours, units", () => {
    const r = teachingSummary([entry({ unit: "Unit 2" }), entry({ date: "2026-11-04", unit: "Unit 10" }), entry({ unit: "Unit 2", type: "meeting" }), entry({ subjectId: "b", type: "lab", start: "09:00", end: "11:00" })], [sem()]);
    const a = r.find((x) => x.subjectId === "a")!;
    expect(a).toMatchObject({ sessions: 2, minutes: 120, units: ["Unit 2", "Unit 10"], first: "2026-11-04", last: "2026-11-11", label: "HS101 Hardware Security" });
    expect(r.find((x) => x.subjectId === "b")!.minutes).toBe(120);
    expect(r.find((x) => x.subjectId === "c")!.sessions).toBe(0);
  });
  it("period overlap", () => {
    expect(overlaps("2026-03-01", "2026-05-01", "2026-04-01", "2026-12-31")).toBe(true);
    expect(overlaps("2026-03-01", "", "2026-04-01", "")).toBe(false);
    expect(overlaps("", "", "", "")).toBe(false);
  });
});

describe("office: duties", () => {
  const d = (deadline: string, status: "open" | "done" = "open") => ({ status, deadline, remindDays: [7, 2, 0] });
  it("states", () => {
    expect(dutyState(d("2026-11-10"), "2026-11-11")).toEqual({ state: "overdue", daysLeft: -1 });
    expect(dutyState(d("2026-11-11"), "2026-11-11").state).toBe("today");
    expect(dutyState(d("2026-11-18"), "2026-11-11").state).toBe("soon");
    expect(dutyState(d("2026-11-19"), "2026-11-11").state).toBe("later");
    expect(dutyState(d("2026-11-01", "done"), "2026-11-11").state).toBe("done");
  });
  it("ics with alarms at 09:00 and escaping", () => {
    const ics = dutyIcs({ id: "D1", title: "Submit report; NAAC, part 2", details: "Line1\nLine2", deadline: "2026-11-20", remindDays: [2, 0, 7], assignedBy: "Dean" }, new Date("2026-11-11T00:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
    expect(ics).toContain("DTEND;VALUE=DATE:20261121");
    expect(ics).toContain("SUMMARY:Deadline: Submit report\; NAAC\\, part 2");
    expect(ics).toContain("TRIGGER:-P6DT15H");
    expect(ics).toContain("TRIGGER:-P1DT15H");
    expect(ics).toContain("TRIGGER:PT9H");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(() => dutyIcs({ id: "x", title: "t", details: "", deadline: "", remindDays: [], assignedBy: "" })).toThrow();
  });
});

import { buildCv } from "@/lib/domain/office";
describe("office: CV", () => {
  it("merges filed records with automatic sections, hides hidden ones, newest first", () => {
    const rec = (o: object) => ({ id: "r", title: "T", categories: ["Award / honour"], date: "2024-01-01", endDate: "", level: "National", role: "", organisation: "Org", details: "", amount: "", url: "", cvSection: "awards", files: [], createdAt: 0, updatedAt: 0, ...o });
    const out = (o: object) => ({ id: "o", kind: "publication", subtype: "journal", title: "Paper", authors: "A, B", memberUids: [], memberNames: [], mentorUids: [], projectId: "", projectTitle: "", venue: "J", year: "2025", identifier: "doi:1", url: "", date: "", trl: 0, notes: "", status: "published", public: false, publicSummary: "", archived: false, files: [], filePaths: [], history: [], createdBy: "", createdAt: 0, updatedAt: 0, ...o });
    const cv = buildCv({
      profile: { hiddenSections: ["talks"] },
      sections: [{ id: "awards", title: "Awards" }, { id: "publications", title: "Publications" }, { id: "talks", title: "Talks" }, { id: "teaching", title: "Teaching" }, { id: "patents", title: "Patents" }],
      records: [rec({ title: "Old award" }), rec({ title: "New award", date: "2026-02-01" }), rec({ title: "Talk", cvSection: "talks" })] as never,
      outputs: [out({}), out({ title: "Draft", status: "drafting" }), out({ title: "Arch", archived: true }), out({ kind: "patent", status: "filed", title: "Pat", subtype: "IN", identifier: "2026/1" })] as never,
      scholars: [], programmes: [], completed: [],
      semesters: [{ id: "S", name: "Odd 2026", startDate: "2026-07-01", endDate: "", active: true, createdAt: 0, updatedAt: 0, subjects: [{ id: "a", code: "HS1", name: "HW Sec", programme: "M.Tech", kind: "theory", units: 5, slots: [] }] }],
    });
    expect(cv.map((s) => s.id)).toEqual(["awards", "publications", "teaching", "patents"]);
    expect(cv[0]!.items.map((i) => i.text)).toEqual(["New award, Org, National", "Old award, Org, National"]);
    expect(cv[1]!.items).toHaveLength(1);
    expect(cv[1]!.items[0]!.text).toBe("A, B. Paper. J (2025). doi:1");
    expect(cv[2]!.items[0]!.text).toBe("Odd 2026: HS1 HW Sec (M.Tech)");
    expect(cv[3]!.items[0]!.text).toContain("Pat. IN 2026/1 (filed");
  });
});
