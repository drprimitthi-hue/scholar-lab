import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildBundle, winAnsi, type Reader } from "@/lib/server/bundle";

async function pdf(pages: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) d.addPage([300, 400]).drawText(`page ${i + 1}`, { x: 20, y: 200, font: f, size: 12 });
  return d.save();
}
// 1x1 transparent PNG
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("evidence bundle", () => {
  it("cover + index + files in order, with page numbers; bad files are listed, not fatal", async () => {
    const store: Record<string, { type: string; data: Uint8Array }> = {
      "office/u/a.pdf": { type: "application/pdf", data: await pdf(2) },
      "office/u/b.png": { type: "image/png", data: PNG },
      "office/u/c.pdf": { type: "application/pdf", data: await pdf(3) },
      "office/u/bad.pdf": { type: "application/pdf", data: new TextEncoder().encode("not a pdf") },
    };
    const read: Reader = async (p) => { const f = store[p]; if (!f) throw new Error("missing"); return { size: f.data.length, type: f.type, bytes: async () => f.data }; };
    const file = (path: string) => ({ path, name: path.split("/").pop()!, at: 0, by: "u" });
    const r = await buildBundle({
      title: "Appraisal 2025–26 — evidence", owner: "Dr. Test ₹", period: "Period: x",
      items: [
        { section: "Award / honour", date: "01 Jan 2026", title: "Best paper “award”", detail: "", files: [file("office/u/a.pdf"), file("office/u/b.png")] },
        { section: "Office order", date: "02 Jan 2026", title: "No file item", detail: "", files: [] },
        { section: "Training", date: "03 Jan 2026", title: "FDP", detail: "", files: [file("office/u/bad.pdf"), file("office/u/c.pdf"), file("office/u/missing.pdf")] },
      ],
    }, read);
    expect(r.files).toBe(3);
    expect(r.skipped).toEqual(["bad.pdf (could not be read)", "missing.pdf (could not be read)"]);
    const out = await PDFDocument.load(r.bytes);
    expect(out.getPageCount()).toBe(1 + 1 + 2 + 1 + 3); // cover, index, a(2), png(1), c(3)
  });
  it("maps characters the standard fonts cannot draw", () => {
    expect(winAnsi("“Hi” – ₹5 … नमस्ते")).toBe('"Hi" - Rs.5 ... ??????');
  });
});

import { groupForParts } from "@/lib/server/bundle";
describe("bundle parts", () => {
  const MB = 1024 * 1024;
  it("everything in one part when it fits (Firebase: unlimited)", () => {
    expect(groupForParts([[MB], [], [2 * MB]], Number.POSITIVE_INFINITY).parts).toEqual([[0, 1, 2]]);
  });
  it("starts a new part when the budget would be exceeded, keeping order", () => {
    expect(groupForParts([[4 * MB], [4 * MB], [], [3 * MB], [8 * MB]], 9 * MB).parts).toEqual([[0, 1, 2], [3], [4]]);
  });
  it("reports single files that can never fit, without losing the item", () => {
    const r = groupForParts([[2 * MB, 12 * MB], [1 * MB]], 9 * MB);
    expect(r.tooLarge).toEqual([[0, 1]]);
    expect(r.parts).toEqual([[0, 1]]);
  });
  it("no items, no parts", () => expect(groupForParts([], 9 * MB).parts).toEqual([]));
});
