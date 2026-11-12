import { describe, expect, it } from "vitest";
import { PIPELINES, bomTotal, canMove, canSubmitStage, initialStatus, isLocked, isPublishable, publicationType, stageProgress } from "@/lib/domain/outputs";

describe("outputs pipeline", () => {
  it("scholars cannot claim submission/acceptance; supervisor can", () => {
    expect(canMove("scholar", "publication", "drafting", "internal_review")).toBe(true);
    expect(canMove("scholar", "publication", "internal_review", "submitted")).toBe(false);
    expect(canMove("mentor", "publication", "drafting", "accepted")).toBe(false);
    expect(canMove("supervisor", "publication", "drafting", "accepted")).toBe(true);
    expect(canMove("alumni", "publication", "idea", "drafting")).toBe(false);
  });
  it("locked once supervisor-confirmed; scholars cannot move back out", () => {
    expect(isLocked("publication", "submitted")).toBe(true);
    expect(isLocked("publication", "drafting")).toBe(false);
    expect(canMove("scholar", "publication", "submitted", "drafting")).toBe(false);
    expect(canMove("supervisor", "publication", "submitted", "drafting")).toBe(true);
  });
  it("rejects unknown and same statuses", () => {
    expect(canMove("supervisor", "patent", "idea", "accepted")).toBe(false);
    expect(canMove("supervisor", "patent", "idea", "idea")).toBe(false);
  });
  it("website only when public AND publishable", () => {
    expect(isPublishable("publication", "accepted", true)).toBe(true);
    expect(isPublishable("publication", "accepted", false)).toBe(false);
    expect(isPublishable("publication", "submitted", true)).toBe(false);
    expect(isPublishable("thesis_chapter", "final", true)).toBe(false);
    expect(isPublishable("patent", "filed", true)).toBe(false);
    expect(isPublishable("patent", "granted", true)).toBe(true);
  });
  it("maps types", () => {
    expect(publicationType("patent", "")).toBe("patent");
    expect(publicationType("publication", "conference")).toBe("conference");
    expect(publicationType("publication", "weird")).toBe("other");
    expect(publicationType("product", "")).toBeNull();
  });
  it("every pipeline starts at a step anyone can set", () => {
    for (const k of Object.keys(PIPELINES) as (keyof typeof PIPELINES)[]) expect(PIPELINES[k][0]!.supervisorOnly).toBeFalsy();
    expect(initialStatus("software")).toBe("development");
  });
});

describe("prototype gates", () => {
  const st = (...s: ("open" | "submitted" | "approved" | "revise")[]) => s.map((status) => ({ status }));
  it("requires earlier stages approved", () => {
    expect(canSubmitStage(st("open", "open"), 0)).toBe(true);
    expect(canSubmitStage(st("open", "open"), 1)).toBe(false);
    expect(canSubmitStage(st("approved", "revise"), 1)).toBe(true);
    expect(canSubmitStage(st("approved", "submitted"), 1)).toBe(false);
    expect(canSubmitStage(st("approved"), 3)).toBe(false);
  });
  it("progress and BOM", () => {
    expect(stageProgress(st("approved", "open", "open", "approved"))).toBe(50);
    expect(bomTotal([{ qty: 3, unitCost: 1.1 }, { qty: 2, unitCost: 250 }])).toBe(503.3);
  });
});
