import { describe, expect, it } from "vitest";
import { averageScores, buildRota, createsCycle, levels, pickSeeded, prerequisitesMet } from "@/lib/domain/concepts";

const C = (id: string, prerequisites: string[] = []) => ({ id, prerequisites });

describe("concept graph", () => {
  it("detects cycles", () => {
    const cs = [C("a"), C("b", ["a"]), C("c", ["b"])];
    expect(createsCycle(cs, "a", ["c"])).toBe(true);
    expect(createsCycle(cs, "a", ["a"])).toBe(true);
    expect(createsCycle(cs, "d", ["c"])).toBe(false);
  });
  it("levels by longest chain", () => {
    const l = levels([C("a"), C("b", ["a"]), C("c", ["a", "b"]), C("x")]);
    expect([l.get("a"), l.get("b"), l.get("c"), l.get("x")]).toEqual([0, 1, 2, 0]);
  });
  it("prerequisites need at least 'explained'", () => {
    const c = C("c", ["a", "b"]);
    expect(prerequisitesMet(c, new Map([["a", "explained"], ["b", "taught"]]))).toBe(true);
    expect(prerequisitesMet(c, new Map([["a", "heard"], ["b", "taught"]]))).toBe(false);
    expect(prerequisitesMet(C("z"), new Map())).toBe(true);
  });
});

describe("seminars", () => {
  it("rota rotates fairly without repeats in a session", () => {
    const r = buildRota(["a", "b", "c"], 2, 3, "2026-11-12", 7);
    expect(r).toEqual([
      { date: "2026-11-12", uids: ["a", "b"] },
      { date: "2026-11-19", uids: ["c", "a"] },
      { date: "2026-11-26", uids: ["b", "c"] },
    ]);
    expect(buildRota(["a"], 3, 1, "2026-11-12", 7)[0]!.uids).toEqual(["a"]);
  });
  it("averages rubric scores", () => {
    const a = averageScores([{ scores: { clarity: 4, depth: 2, critical: 3, qa: 3 } }, { scores: { clarity: 2, depth: 4, critical: 3, qa: 5 } }]);
    expect(a).toMatchObject({ clarity: 3, depth: 3, critical: 3, qa: 4, overall: 3.25, n: 2 });
    expect(averageScores([]).n).toBe(0);
  });
  it("seeded pick is stable and bounded", () => {
    const xs = ["p", "q", "r", "s", "t"];
    expect(pickSeeded(xs, 2, "seed")).toEqual(pickSeeded(xs, 2, "seed"));
    expect(pickSeeded(xs, 10, "x")).toHaveLength(5);
    expect(new Set(pickSeeded(xs, 3, "y")).size).toBe(3);
  });
});
