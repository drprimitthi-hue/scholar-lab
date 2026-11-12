import type { Batch, CardFields, LitItem, LitPriority, LitType, ReleaseMode } from "../types";
import { addDays, dayOfWeek } from "./dates";
import { parseCsv } from "./csv";

export const LIT_TYPES: LitType[] = ["review", "primary", "patent", "standard", "datasheet", "tutorial", "other"];
export const LIT_PRIORITIES: LitPriority[] = ["core", "supporting", "optional"];

export type ImportRow = Omit<LitItem, "addedAt" | "source">;

/** Turn CSV text into literature rows. Header names are case-insensitive; unknown columns are ignored. */
export function rowsFromCsv(text: string): { items: ImportRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { items: [], errors: ["The file has no data rows."] };
  const head = table[0]!.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const ix = {
    id: col("id"), title: col("title"), authors: col("authors", "author"), year: col("year"), venue: col("venue", "journal"),
    url: col("url", "link", "doi"), type: col("type"), priority: col("priority"), theme: col("theme", "topic"),
    est: col("est_minutes", "minutes", "est"), order: col("order_hint", "order"),
  };
  if (ix.title < 0 || ix.url < 0) return { items: [], errors: ["The CSV needs at least 'title' and 'url' columns."] };
  const items: ImportRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((r, n) => {
    const line = n + 2;
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const title = get(ix.title);
    let url = get(ix.url);
    if (/^10\.\d{4,}\//.test(url)) url = `https://doi.org/${url}`;
    if (!title) return errors.push(`Line ${line}: missing title`);
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return errors.push(`Line ${line}: link must start with http:// or https://`);
    let id = get(ix.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || `L${String(line - 1).padStart(4, "0")}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const type = get(ix.type).toLowerCase() as LitType;
    const priority = get(ix.priority).toLowerCase() as LitPriority;
    const est = Number(get(ix.est));
    const order = Number(get(ix.order));
    items.push({
      id,
      title: title.slice(0, 400),
      authors: get(ix.authors).slice(0, 400),
      year: get(ix.year).slice(0, 10),
      venue: get(ix.venue).slice(0, 200),
      url: url.slice(0, 1000),
      type: LIT_TYPES.includes(type) ? type : "primary",
      priority: LIT_PRIORITIES.includes(priority) ? priority : "supporting",
      theme: get(ix.theme).slice(0, 80) || "General",
      estMinutes: Number.isFinite(est) && est > 0 ? Math.min(Math.round(est), 600) : 30,
      orderHint: Number.isFinite(order) ? order : line,
    });
  });
  return { items, errors };
}

const typeRank = (t: LitType) => (t === "review" ? 0 : 1);
const prioRank = (p: LitPriority) => LIT_PRIORITIES.indexOf(p);

/** Reading order: reviews first, then core → supporting → optional, grouped by theme (first-seen order), then order hint. */
export function readingOrder<T extends Pick<LitItem, "type" | "priority" | "theme" | "orderHint">>(items: T[]): T[] {
  const themeRank = new Map<string, number>();
  [...items].sort((a, b) => a.orderHint - b.orderHint).forEach((x) => themeRank.has(x.theme) || themeRank.set(x.theme, themeRank.size));
  return [...items].sort(
    (a, b) =>
      typeRank(a.type) - typeRank(b.type) ||
      prioRank(a.priority) - prioRank(b.priority) ||
      themeRank.get(a.theme)! - themeRank.get(b.theme)! ||
      a.orderHint - b.orderHint,
  );
}

export interface Calendar {
  weekendDays: number[];
  holidays: string[];
  leaveDays: string[];
}

export function isWorkingDay(date: string, cal: Calendar): boolean {
  return !cal.weekendDays.includes(dayOfWeek(date)) && !cal.holidays.includes(date) && !cal.leaveDays.includes(date);
}

export function nextWorkingDay(from: string, cal: Calendar): string {
  let d = from;
  for (let i = 0; i < 400 && !isWorkingDay(d, cal); i++) d = addDays(d, 1);
  return d;
}

/** Pack items into daily batches within a reading budget (at least one item per working day). */
export function makeBatches(
  items: Pick<LitItem, "id" | "estMinutes">[],
  dailyMinutes: number,
  startDate: string,
  cal: Calendar,
  firstNo = 1,
): Batch[] {
  const batches: Batch[] = [];
  let date = nextWorkingDay(startDate, cal);
  let cur: Batch = { no: firstNo, date, itemIds: [] };
  let used = 0;
  for (const it of items) {
    if (cur.itemIds.length > 0 && used + it.estMinutes > dailyMinutes) {
      batches.push(cur);
      date = nextWorkingDay(addDays(date, 1), cal);
      cur = { no: cur.no + 1, date, itemIds: [] };
      used = 0;
    }
    cur.itemIds.push(it.id);
    used += it.estMinutes;
  }
  if (cur.itemIds.length) batches.push(cur);
  return batches;
}

/** Which batches are released to the scholar today. */
export function releasedBatches(
  batches: Batch[],
  today: string,
  mode: ReleaseMode,
  threshold: number,
  acceptedIds: Set<string>,
): Set<number> {
  const out = new Set<number>();
  const sorted = [...batches].sort((a, b) => a.no - b.no);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]!;
    const dateOk = b.date <= today;
    let gateOk = true;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      const done = prev.itemIds.filter((id) => acceptedIds.has(id)).length;
      gateOk = out.has(prev.no) && (prev.itemIds.length === 0 || done / prev.itemIds.length >= threshold - 1e-9);
    }
    const ok = mode === "date" ? dateOk : mode === "gated" ? gateOk : dateOk && gateOk;
    if (!ok) {
      if (mode !== "date") break; // gated plans release strictly in order
      continue;
    }
    out.add(b.no);
  }
  return out;
}

export const wordCount = (s: string | undefined) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

/** Card completeness check (also enforced on the server). Returns a list of problems. */
export function cardProblems(c: CardFields, minWords: number): string[] {
  const p: string[] = [];
  const need: [keyof CardFields, string][] = [
    ["problem", "Problem"],
    ["method", "Method"],
    ["keyResult", "Key result"],
    ["limitations", "Limitations"],
  ];
  for (const [k, label] of need) if (wordCount(c[k] as string) < minWords) p.push(`${label}: at least ${minWords} words`);
  if (c.concepts.filter((x) => x.trim()).length < 3) p.push("List 3 key concepts");
  if (!(c.relevance >= 1 && c.relevance <= 5)) p.push("Relevance must be 1–5");
  if (wordCount(c.citableClaim) < 5) p.push("Citable claim: at least 5 words");
  return p;
}
