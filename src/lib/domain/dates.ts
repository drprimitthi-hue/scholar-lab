// Pure date helpers. All calendar dates are "YYYY-MM-DD" strings (no time zone ambiguity).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTC(s: string): Date {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date in the given IANA time zone. */
export function todayInTz(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Add calendar months, clamping to the last day of the month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const d = toUTC(date);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUTC(target);
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function dayOfWeek(date: string): number {
  return toUTC(date).getUTCDay();
}

/** Inclusive list of dates from..to. Capped to protect against huge ranges. */
export function dateRange(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  let cur = from;
  while (daysBetween(cur, to) >= 0 && out.length < max) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Working days in an inclusive range, excluding weekend days and holidays. */
export function workingDays(from: string, to: string, weekendDays: number[], holidays: string[]): number {
  const hol = new Set(holidays);
  return dateRange(from, to).filter((d) => !weekendDays.includes(dayOfWeek(d)) && !hol.has(d)).length;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  if (!isIsoDate(date)) return date;
  return toUTC(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatTime(ms: number | null | undefined, timeZone: string): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Epoch ms for a wall-clock time ("HH:MM") on a date in the given time zone. */
export function zonedEpoch(date: string, hhmm: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess, timeZone);
  let t = guess - off1;
  const off2 = tzOffsetMs(t, timeZone);
  if (off2 !== off1) t = guess - off2;
  return t;
}
