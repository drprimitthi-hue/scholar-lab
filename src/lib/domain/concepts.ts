import type { Concept, Mastery, Rubric } from "../types";
import { addDays } from "./dates";

export const MASTERY: Mastery[] = ["heard", "explained", "applied", "taught"];
export const masteryRank = (m: Mastery | undefined | null) => (m ? MASTERY.indexOf(m) + 1 : 0);

/** True if adding these prerequisites to `id` would create a cycle. */
export function createsCycle(concepts: Pick<Concept, "id" | "prerequisites">[], id: string, prerequisites: string[]): boolean {
  const map = new Map(concepts.map((c) => [c.id, c.prerequisites]));
  map.set(id, prerequisites);
  const seen = new Set<string>();
  const stack = [...prerequisites];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === id) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(map.get(cur) ?? []));
  }
  return false;
}

/** Level of each concept = length of the longest prerequisite chain below it (roots are level 0). */
export function levels(concepts: Pick<Concept, "id" | "prerequisites">[]): Map<string, number> {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const memo = new Map<string, number>();
  const visit = (id: string, path: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (path.has(id)) return 0; // defensive: ignore cycles
    path.add(id);
    const pre = (byId.get(id)?.prerequisites ?? []).filter((p) => byId.has(p));
    const lv = pre.length ? 1 + Math.max(...pre.map((p) => visit(p, path))) : 0;
    path.delete(id);
    memo.set(id, lv);
    return lv;
  };
  concepts.forEach((c) => visit(c.id, new Set()));
  return memo;
}

/** A scholar may start a concept once every prerequisite is at least "explained" (note accepted). */
export function prerequisitesMet(c: Pick<Concept, "prerequisites">, masteryByConcept: Map<string, Mastery>): boolean {
  return c.prerequisites.every((p) => masteryRank(masteryByConcept.get(p)) >= masteryRank("explained"));
}

/** Round-robin speakers across sessions: every scholar speaks in turn, never twice in one session. */
export function buildRota(uids: string[], perSession: number, count: number, startDate: string, everyDays: number): { date: string; uids: string[] }[] {
  const out: { date: string; uids: string[] }[] = [];
  const per = Math.min(perSession, uids.length);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const slot: string[] = [];
    for (let j = 0; j < per; j++) slot.push(uids[k++ % uids.length]!);
    out.push({ date: addDays(startDate, i * everyDays), uids: slot });
  }
  return out;
}

export const rubricMean = (r: Rubric) => (r.clarity + r.depth + r.critical + r.qa) / 4;

export function averageScores(scores: { scores: Rubric }[]): Rubric & { overall: number; n: number } {
  const n = scores.length;
  if (!n) return { clarity: 0, depth: 0, critical: 0, qa: 0, overall: 0, n: 0 };
  const sum = (k: keyof Rubric) => scores.reduce((s, x) => s + x.scores[k], 0) / n;
  const r = { clarity: sum("clarity"), depth: sum("depth"), critical: sum("critical"), qa: sum("qa") };
  return { ...r, overall: rubricMean(r), n };
}

/** Deterministic pick of n items (seeded), so a re-run gives the same spot-check. */
export function pickSeeded<T>(items: T[], n: number, seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}
