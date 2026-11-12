// Outputs register and prototype lab: pure rules (no Firebase), unit-tested.
import type { OutputKind, Role } from "../types";

export interface StepDef { id: string; label: string; supervisorOnly?: boolean; terminal?: boolean; public?: boolean }

/** Status pipeline per kind. supervisorOnly = only the supervisor may move an output INTO this status.
 *  public = an output in this status may appear on the lab website (if the supervisor also made it public). */
export const PIPELINES: Record<OutputKind, StepDef[]> = {
  publication: [
    { id: "idea", label: "Idea" },
    { id: "drafting", label: "Drafting" },
    { id: "internal_review", label: "Internal review" },
    { id: "submitted", label: "Submitted", supervisorOnly: true },
    { id: "under_review", label: "Under review", supervisorOnly: true },
    { id: "revision", label: "Revision", supervisorOnly: true },
    { id: "accepted", label: "Accepted", supervisorOnly: true, public: true },
    { id: "published", label: "Published", supervisorOnly: true, terminal: true, public: true },
    { id: "rejected", label: "Rejected", supervisorOnly: true },
  ],
  patent: [
    { id: "idea", label: "Idea" },
    { id: "drafting", label: "Drafting" },
    { id: "filed", label: "Filed", supervisorOnly: true },
    { id: "published", label: "Published (application)", supervisorOnly: true, public: true },
    { id: "examination", label: "Under examination", supervisorOnly: true, public: true },
    { id: "granted", label: "Granted", supervisorOnly: true, terminal: true, public: true },
    { id: "rejected", label: "Refused / abandoned", supervisorOnly: true },
  ],
  product: [
    { id: "concept", label: "Concept" },
    { id: "development", label: "In development" },
    { id: "validated", label: "Validated", supervisorOnly: true, public: true },
    { id: "deployed", label: "Deployed / transferred", supervisorOnly: true, terminal: true, public: true },
  ],
  software: [
    { id: "development", label: "In development" },
    { id: "released", label: "Released", supervisorOnly: true, terminal: true, public: true },
  ],
  dataset: [
    { id: "collecting", label: "Collecting" },
    { id: "released", label: "Released", supervisorOnly: true, terminal: true, public: true },
  ],
  thesis_chapter: [
    { id: "outline", label: "Outline" },
    { id: "draft", label: "Draft" },
    { id: "review", label: "Supervisor review" },
    { id: "revised", label: "Revised" },
    { id: "final", label: "Final", supervisorOnly: true, terminal: true },
  ],
};

export const KIND_LABEL: Record<OutputKind, string> = {
  publication: "Publication", patent: "Patent", product: "Product", software: "Software", dataset: "Dataset", thesis_chapter: "Thesis chapter",
};

export const stepOf = (kind: OutputKind, status: string) => PIPELINES[kind].find((s) => s.id === status);
export const isValidStatus = (kind: OutputKind, status: string) => !!stepOf(kind, status);
export const initialStatus = (kind: OutputKind) => PIPELINES[kind][0]!.id;

/** Once an output reaches a supervisor-confirmed status, only the supervisor may edit it (official record). */
export function isLocked(kind: OutputKind, status: string): boolean {
  return !!stepOf(kind, status)?.supervisorOnly;
}

/** Can this role move the output from `from` to `to`? */
export function canMove(role: Role, kind: OutputKind, from: string, to: string): boolean {
  if (from === to || !isValidStatus(kind, to) || !isValidStatus(kind, from)) return false;
  if (role === "supervisor") return true;
  if (role === "alumni") return false;
  // Mentors and scholars move only between non-supervisor steps, and never out of a locked step.
  return !stepOf(kind, to)!.supervisorOnly && !isLocked(kind, from);
}

/** Visible on the website only when the supervisor made it public AND the status is publishable. */
export const isPublishable = (kind: OutputKind, status: string, publicFlag: boolean) => publicFlag && !!stepOf(kind, status)?.public;

/** Map an output to the website's publication types (products/software/datasets are not listed on Publications). */
export function publicationType(kind: OutputKind, subtype: string): "journal" | "conference" | "book" | "chapter" | "patent" | "other" | null {
  if (kind === "patent") return "patent";
  if (kind !== "publication") return null;
  return (["journal", "conference", "book", "chapter"] as const).find((t) => t === subtype) ?? "other";
}

// ---------- Prototypes ----------
export const DEFAULT_STAGES = ["Requirements", "Design", "Build", "Test", "Demo"];
export type GateStatus = "open" | "submitted" | "approved" | "revise";

/** A stage may be submitted only when every earlier stage is approved. */
export function canSubmitStage(stages: { status: GateStatus }[], index: number): boolean {
  if (index < 0 || index >= stages.length) return false;
  const s = stages[index]!.status;
  if (s === "approved" || s === "submitted") return false;
  return stages.slice(0, index).every((x) => x.status === "approved");
}

export const stageProgress = (stages: { status: GateStatus }[]) => (stages.length ? Math.round((stages.filter((x) => x.status === "approved").length / stages.length) * 100) : 0);

export function bomTotal(items: { qty: number; unitCost: number }[]): number {
  return Math.round(items.reduce((t, i) => t + i.qty * i.unitCost, 0) * 100) / 100;
}

export const TRL_LABEL = [
  "", "Basic principles observed", "Concept formulated", "Proof of concept", "Validated in lab", "Validated in relevant environment",
  "Demonstrated in relevant environment", "Demonstrated in operational environment", "System complete and qualified", "Proven in operation",
];
