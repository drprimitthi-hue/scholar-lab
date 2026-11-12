import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "@/lib/domain/csv";
import { cardProblems, makeBatches, readingOrder, releasedBatches, rowsFromCsv } from "@/lib/domain/literature";

describe("csv", () => {
  it("parses quotes, commas and newlines inside fields", () => {
    const t = 'a,b,c\r\n"x, y","he said ""hi""","multi\nline"\n\n1,2,3';
    expect(parseCsv(t)).toEqual([["a", "b", "c"], ["x, y", 'he said "hi"', "multi\nline"], ["1", "2", "3"]]);
  });
  it("strips BOM and caps rows", () => {
    expect(parseCsv("﻿id\n1")[0]).toEqual(["id"]);
    expect(() => parseCsv("a\n".repeat(20), 5)).toThrow();
  });
  it("neutralises spreadsheet formulas on export", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("plain")).toBe("plain");
    expect(toCsv(["h"], [["a,b"]])).toBe('h\r\n"a,b"');
  });
});

describe("literature import", () => {
  it("maps columns, normalises DOIs, rejects unsafe links, de-duplicates ids", () => {
    const csv = [
      "ID,Title,Authors,Year,Venue,URL,Type,Priority,Theme,est_minutes,order_hint",
      'L1,"A survey of PUFs",X,2021,IEEE,https://doi.org/10.1/x,review,core,PUF,45,1',
      "L1,Second,Y,2022,J,10.1109/abc,primary,supporting,PUF,30,2",
      "L3,Bad link,Z,2020,J,javascript:alert(1),primary,core,PUF,30,3",
      ",No id,Z,2020,J,http://example.org/p,weird,odd,,,",
    ].join("\n");
    const { items, errors } = rowsFromCsv(csv);
    expect(errors).toEqual(["Line 4: link must start with http:// or https://"]);
    expect(items.map((i) => i.id)).toEqual(["L1", "L1x", "L0004"]);
    expect(items[1]!.url).toBe("https://doi.org/10.1109/abc");
    expect(items[2]).toMatchObject({ type: "primary", priority: "supporting", theme: "General", estMinutes: 30 });
  });
  it("requires title and url columns", () => {
    expect(rowsFromCsv("name,link2\na,b").errors[0]).toContain("title");
  });
});

describe("batching", () => {
  const items = [
    { id: "p1", type: "primary" as const, priority: "core" as const, theme: "B", orderHint: 1, estMinutes: 30 },
    { id: "r1", type: "review" as const, priority: "supporting" as const, theme: "A", orderHint: 5, estMinutes: 60 },
    { id: "o1", type: "primary" as const, priority: "optional" as const, theme: "A", orderHint: 2, estMinutes: 30 },
    { id: "c2", type: "primary" as const, priority: "core" as const, theme: "A", orderHint: 3, estMinutes: 30 },
  ];
  it("orders reviews first, then by priority and theme", () => {
    expect(readingOrder(items).map((i) => i.id)).toEqual(["r1", "p1", "c2", "o1"]);
  });
  it("packs within the daily budget and skips off-days, holidays and leave", () => {
    const cal = { weekendDays: [0], holidays: ["2026-11-10"], leaveDays: ["2026-11-12"] };
    // Mon 9 Nov start; 60-minute budget
    const b = makeBatches(readingOrder(items), 60, "2026-11-08", cal);
    expect(b).toEqual([
      { no: 1, date: "2026-11-09", itemIds: ["r1"] },
      { no: 2, date: "2026-11-11", itemIds: ["p1", "c2"] },
      { no: 3, date: "2026-11-13", itemIds: ["o1"] },
    ]);
  });
  it("puts an over-budget item alone on a day", () => {
    expect(makeBatches([{ id: "x", estMinutes: 500 }, { id: "y", estMinutes: 10 }], 60, "2026-11-09", { weekendDays: [], holidays: [], leaveDays: [] }).length).toBe(2);
  });
  it("releases by date, by completion gate, or both", () => {
    const bs = [
      { no: 1, date: "2026-11-09", itemIds: ["a", "b"] },
      { no: 2, date: "2026-11-10", itemIds: ["c"] },
      { no: 3, date: "2026-11-11", itemIds: ["d"] },
    ];
    expect([...releasedBatches(bs, "2026-11-10", "date", 0.8, new Set())]).toEqual([1, 2]);
    expect([...releasedBatches(bs, "2026-11-01", "gated", 0.8, new Set(["a", "b", "c"]))]).toEqual([1, 2, 3]);
    expect([...releasedBatches(bs, "2026-11-01", "gated", 0.8, new Set(["a"]))]).toEqual([1]);
    expect([...releasedBatches(bs, "2026-11-10", "both", 0.8, new Set(["a", "b", "c"]))]).toEqual([1, 2]);
    expect([...releasedBatches(bs, "2026-11-12", "both", 0.5, new Set(["a"]))]).toEqual([1, 2]);
  });
});

describe("reading card", () => {
  const good = {
    problem: "one two three four five", method: "one two three four five", setup: "", keyResult: "one two three four five",
    limitations: "one two three four five", concepts: ["a", "b", "c"], relevance: 4, citableClaim: "this is a claim here",
  };
  it("accepts a complete card", () => expect(cardProblems(good, 5)).toEqual([]));
  it("flags short fields, missing concepts and bad relevance", () => {
    const p = cardProblems({ ...good, method: "too short", concepts: ["a", " ", ""], relevance: 0 }, 5);
    expect(p).toHaveLength(3);
  });
});
