import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/admin";
import { bundlePartBytes, fileInfo, readBytes, readUrl, saveBytes } from "@/lib/server/storage";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { getSettings } from "@/lib/server/settings";
import { buildBundle, groupForParts, type BundleItem, type Reader } from "@/lib/server/bundle";
import { bundleSchema } from "@/lib/schemas";
import { formatDate } from "@/lib/domain/dates";
import { inPeriod, overlaps } from "@/lib/domain/office";
import type { CvProfile, DutyDoc, MeetingDoc, OrderDoc, RecordDoc } from "@/lib/types";

export const maxDuration = 120;

/** Merge the evidence files of the chosen period/categories into PDF(s) with cover + index + files. Stored privately; returns 10-minute links.
 *  On Cloudinary's free plan (10 MB per file) large bundles are split into numbered parts. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"], write: false });
  if (!rateLimit(`bundle:${ctx.uid}`, 6, 60_000)) throw new HttpError(429, "Too many bundles; wait a minute");
  const q = await parseBody(req, bundleSchema);
  const want = new Set(q.categories);
  const catOk = (c: string[]) => !want.size || c.some((x) => want.has(x));
  const items: BundleItem[] = [];
  const d = (x: string) => (x ? formatDate(x) : "");
  if (q.include.includes("records")) {
    for (const r of (await db().collection("officeRecords").get()).docs.map((x) => x.data() as RecordDoc).filter((r) => overlaps(r.date, r.endDate, q.from, q.to) && catOk(r.categories)).sort((a, b) => a.date.localeCompare(b.date)))
      items.push({ section: r.categories.join(", "), date: d(r.date), title: r.title, detail: r.details, files: r.files });
  }
  if (q.include.includes("orders")) {
    for (const o of (await db().collection("officeOrders").get()).docs.map((x) => x.data() as OrderDoc).filter((o) => inPeriod(o.date, q.from, q.to) && catOk(o.categories)).sort((a, b) => a.date.localeCompare(b.date)))
      items.push({ section: `Office order${o.type ? ` (${o.type})` : ""}`, date: d(o.date), title: [o.number, o.title].filter(Boolean).join(" - "), detail: o.mention, files: o.files });
  }
  if (q.include.includes("duties")) {
    for (const t of (await db().collection("officeDuties").get()).docs.map((x) => x.data() as DutyDoc).filter((t) => t.status === "done" && inPeriod(t.doneOn, q.from, q.to) && catOk(t.categories)).sort((a, b) => a.doneOn.localeCompare(b.doneOn)))
      items.push({ section: "Duty completed", date: d(t.doneOn), title: t.title, detail: t.outcome, files: t.files });
  }
  if (q.include.includes("meetings") && !want.size) {
    for (const m of (await db().collection("officeMeetings").get()).docs.map((x) => x.data() as MeetingDoc).filter((m) => inPeriod(m.date, q.from, q.to)).sort((a, b) => a.date.localeCompare(b.date)))
      items.push({ section: `Meeting${m.type ? ` (${m.type})` : ""}`, date: d(m.date), title: m.title, detail: m.keyPoints, files: m.files });
  }
  if (!items.length) throw new HttpError(404, "Nothing matches this period and selection");
  const cv = (await db().doc("officeCv/main").get()).data() as CvProfile | undefined;
  const owner = cv?.name || (await getSettings()).supervisorName;
  const period = q.from || q.to ? `Period: ${q.from ? formatDate(q.from) : "start"} to ${q.to ? formatDate(q.to) : "today"}` : "All dates";
  // Look up every file's size once, then group items into parts (one part on Firebase; parts under 9 MB on Cloudinary).
  const meta = new Map<string, { size: number; contentType: string } | null>();
  for (const it of items) for (const f of it.files) if (!meta.has(f.path)) meta.set(f.path, await fileInfo(f.path).catch(() => null));
  const read: Reader = async (p) => {
    const m = meta.get(p) ?? (await fileInfo(p));
    if (!m) throw new Error("missing");
    return { size: m.size, type: m.contentType, bytes: () => readBytes(p) };
  };
  const budget = bundlePartBytes();
  const { parts: groups, tooLarge } = groupForParts(items.map((it) => it.files.map((f) => meta.get(f.path)?.size ?? 0)), budget);
  const skip = new Set(tooLarge.map(([i, j]) => items[i]!.files[j]!.path));
  const extraSkipped = [...skip].map((p) => `${items.flatMap((it) => it.files).find((f) => f.path === p)!.name} (larger than one bundle part; open it from the app)`);
  const queue = groups.map((g) => g.map((i) => ({ ...items[i]!, files: items[i]!.files.filter((f) => !skip.has(f.path)) })));
  const ranges: number[][] = []; // item numbers per part, for labels
  { let n = 1; for (const g of groups) { ranges.push([n, n + g.length - 1]); n += g.length; } }
  const out: { url: string; items: number; files: number; sizeKb: number; label: string }[] = [];
  const skipped = [...extraSkipped];
  const date = new Date().toISOString().slice(0, 10);
  const HARD = budget === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : 10 * 1024 * 1024 - 64 * 1024;
  while (queue.length) {
    const group = queue.shift()!;
    const range = ranges.shift()!;
    const label = groups.length > 1 || out.length ? `Part ${out.length + 1} · items ${range[0]}–${range[1]} of ${items.length}` : "";
    const built = await buildBundle({ title: q.title, owner, period, items: group, label }, read);
    if (built.bytes.length > HARD && group.length > 1) {
      // Too big after merging (cover/index overhead or image re-encoding): split this part in two and retry.
      const half = Math.ceil(group.length / 2);
      queue.unshift(group.slice(0, half), group.slice(half));
      ranges.unshift([range[0]!, range[0]! + half - 1], [range[0]! + half, range[1]!]);
      continue;
    }
    if (built.bytes.length > HARD) { skipped.push(`${group[0]!.title} (too large for one part; open its files from the app)`); continue; }
    const path = `office/${ctx.uid}/bundles/${date}-${randomUUID()}.pdf`;
    await saveBytes(path, built.bytes, "application/pdf");
    out.push({ url: await readUrl(path, 600), items: group.length, files: built.files, sizeKb: Math.round(built.bytes.length / 1024), label });
    skipped.push(...built.skipped);
  }
  if (!out.length) throw new HttpError(422, `No part could be built. ${skipped.join("; ")}`.slice(0, 500));
  const files = out.reduce((t, p) => t + p.files, 0);
  const b = db().batch();
  audit(b, ctx, "office.bundle.generated", "office", "bundle", null, { items: items.length, files, parts: out.length });
  await b.commit();
  return ok({ url: out[0]!.url, parts: out, items: items.length, files, skipped, sizeKb: out.reduce((t, p) => t + p.sizeKb, 0) });
});
