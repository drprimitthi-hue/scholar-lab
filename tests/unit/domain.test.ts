import { describe, expect, it } from "vitest";
import { addMonths, dateRange, daysBetween, isIsoDate, todayInTz, workingDays, zonedEpoch } from "@/lib/domain/dates";
import { degreeProgress, generateMilestones, isOverdue, monthsRemaining } from "@/lib/domain/milestones";
import { shallowDiff, withinRadius } from "@/lib/domain/diff";
import { passwordProblem } from "@/lib/domain/password";
import { DEFAULT_TEMPLATES } from "@/lib/domain/defaults";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });
  it("adds months with end-of-month clamping", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-11-09", 6)).toBe("2027-05-09");
    expect(addMonths("2026-11-09", 0)).toBe("2026-11-09");
  });
  it("counts days and working days", () => {
    expect(daysBetween("2026-11-01", "2026-11-09")).toBe(8);
    // 9–15 Nov 2026: Mon..Sun; Sunday off and one holiday
    expect(workingDays("2026-11-09", "2026-11-15", [0], ["2026-11-11"])).toBe(5);
    expect(dateRange("2026-01-01", "2030-01-01").length).toBe(400); // capped
  });
  it("gives today in a time zone", () => {
    const t = new Date("2026-11-09T20:00:00Z"); // 01:30 next day in India
    expect(todayInTz("Asia/Kolkata", t)).toBe("2026-11-10");
    expect(todayInTz("UTC", t)).toBe("2026-11-09");
  });
  it("converts wall-clock time in a zone to epoch", () => {
    expect(zonedEpoch("2026-11-09", "10:00", "Asia/Kolkata")).toBe(Date.parse("2026-11-09T04:30:00Z"));
    expect(zonedEpoch("2026-07-01", "09:15", "Europe/London")).toBe(Date.parse("2026-07-01T08:15:00Z"));
  });
});

describe("milestones", () => {
  it("expands templates including repeats, sorted by date", () => {
    const phd = DEFAULT_TEMPLATES.find((t) => t.programmeId === "phd")!;
    const ms = generateMilestones(phd.items, "2026-08-01");
    expect(ms.filter((m) => m.title.startsWith("Six-monthly progress review")).length).toBe(6);
    expect(ms[0]!.dueDate <= ms[ms.length - 1]!.dueDate).toBe(true);
    expect(ms.map((m) => m.order)).toEqual(ms.map((_, i) => i));
  });
  it("computes weighted progress, ignoring waived", () => {
    const ms = [
      { weight: 10, status: "approved" as const, dueDate: "2026-01-01" },
      { weight: 30, status: "not_started" as const, dueDate: "2026-06-01" },
      { weight: 50, status: "waived" as const, dueDate: "2026-06-01" },
    ];
    expect(degreeProgress(ms)).toBe(25);
    expect(degreeProgress([])).toBe(0);
  });
  it("flags overdue only for open milestones", () => {
    expect(isOverdue({ weight: 1, status: "not_started", dueDate: "2026-01-01" }, "2026-01-02")).toBe(true);
    expect(isOverdue({ weight: 1, status: "submitted", dueDate: "2026-01-01" }, "2026-01-02")).toBe(false);
    expect(isOverdue({ weight: 1, status: "in_progress", dueDate: "2026-01-02" }, "2026-01-02")).toBe(false);
  });
  it("months remaining of max duration", () => {
    expect(monthsRemaining("2026-01-01", 72, "2026-01-01")).toBe(71);
    expect(monthsRemaining("2020-01-01", 12, "2026-01-01")! < 0).toBe(true);
    expect(monthsRemaining("2020-01-01", 0, "2026-01-01")).toBeNull();
  });
});

describe("misc", () => {
  it("diffs only changed keys", () => {
    expect(shallowDiff({ a: 1, b: [1] }, { a: 1, b: [1, 2], c: "x" })).toEqual({ before: { b: [1], c: null }, after: { b: [1, 2], c: "x" } });
  });
  it("geofence radius", () => {
    expect(withinRadius(23.2156, 72.6369, 23.2156, 72.6369, 50)).toBe(true);
    expect(withinRadius(23.2256, 72.6369, 23.2156, 72.6369, 500)).toBe(false); // ~1.1 km away
  });
  it("password rules", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("alllowercase123")).not.toBeNull();
    expect(passwordProblem("GoodPassword2026")).toBeNull();
  });
});
