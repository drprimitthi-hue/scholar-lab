"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { useCv, useDiary, useDuties, useMeetings, useOfficeSettings, useOrders, useRecords, useSemesters } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { activeSemester, inPeriod, overlaps, teachingSummary } from "@/lib/domain/office";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import { Button, Card, ErrorText, Field, Input, Notice, Select, useAction } from "@/components/ui";
import { MultiSelect } from "@/components/office/bits";

type Part = "teaching" | "records" | "orders" | "duties" | "meetings";
const PARTS: { id: Part; label: string }[] = [
  { id: "teaching", label: "Teaching" }, { id: "records", label: "Records & achievements" }, { id: "orders", label: "Office orders" },
  { id: "duties", label: "Duties completed" }, { id: "meetings", label: "Meetings" },
];

function presets(today: string, sem?: { startDate: string; endDate: string }) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const fy = m >= 4 ? y : y - 1; // April–March year containing today
  const ay = m >= 7 ? y : y - 1; // July–June year containing today
  return [
    { id: "fy-last", label: `Apr ${fy - 1} – Mar ${fy}`, from: `${fy - 1}-04-01`, to: `${fy}-03-31` },
    { id: "fy-now", label: `Apr ${fy} – Mar ${fy + 1} (so far)`, from: `${fy}-04-01`, to: today },
    { id: "ay-last", label: `Jul ${ay - 1} – Jun ${ay}`, from: `${ay - 1}-07-01`, to: `${ay}-06-30` },
    { id: "cal-last", label: `Calendar ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { id: "cal-now", label: `Calendar ${y} (so far)`, from: `${y}-01-01`, to: today },
    ...(sem ? [{ id: "sem", label: "Current semester", from: sem.startDate, to: sem.endDate || today }] : []),
  ];
}

export default function ReportsPage() {
  const ss = useSession();
  const today = todayInTz(ss.settings.timezone);
  const os = useOfficeSettings();
  const sems = useSemesters();
  const sem = activeSemester(sems.data, today);
  const P = presets(today, sem);
  const [from, setFrom] = useState(P[0]!.from);
  const [to, setTo] = useState(P[0]!.to);
  const [cats, setCats] = useState<string[]>([]);
  const [parts, setParts] = useState<Part[]>(PARTS.map((p) => p.id));
  const [title, setTitle] = useState("Activity report");
  const cv = useCv();
  const records = useRecords();
  const orders = useOrders();
  const duties = useDuties();
  const meetings = useMeetings();
  const diary = useDiary(from, to);
  const bundle = useAction();
  const [bundleInfo, setBundleInfo] = useState<string | null>(null);
  const [bundleParts, setBundleParts] = useState<{ url: string; label: string; sizeKb: number }[]>([]);
  const catOk = (c: string[]) => !cats.length || c.some((x) => cats.includes(x));
  const R = records.data.filter((r) => overlaps(r.date, r.endDate, from, to) && catOk(r.categories)).sort((a, b) => a.date.localeCompare(b.date));
  const O = orders.data.filter((o) => inPeriod(o.date, from, to) && catOk(o.categories)).sort((a, b) => a.date.localeCompare(b.date));
  const D = duties.data.filter((d) => d.status === "done" && inPeriod(d.doneOn, from, to) && catOk(d.categories)).sort((a, b) => a.doneOn.localeCompare(b.doneOn));
  const M = cats.length ? [] : meetings.data.filter((m) => inPeriod(m.date, from, to)).sort((a, b) => a.date.localeCompare(b.date));
  const T = useMemo(() => teachingSummary(diary.data, sems.data).filter((x) => x.sessions > 0), [diary.data, sems.data]);
  const byCat = (cats.length ? cats : os.recordCategories).map((c) => ({ c, list: R.filter((r) => r.categories.includes(c)) })).filter((x) => x.list.length);
  const has = (p: Part) => parts.includes(p);
  const owner = cv.data?.name || ss.settings.supervisorName;
  const makeBundle = () => bundle.run(async () => {
    const include = (["records", "orders", "duties", "meetings"] as const).filter((p) => has(p));
    const r = await api<{ parts: { url: string; items: number; files: number; sizeKb: number; label: string }[]; items: number; files: number; skipped: string[]; sizeKb: number }>("/api/office/bundle", "POST", { title: `${title}: evidence`, from, to, categories: cats, include });
    setBundleParts(r.parts);
    setBundleInfo(`${r.items} item(s), ${r.files} file(s), ${Math.round(r.sizeKb / 102.4) / 10} MB${r.parts.length > 1 ? ` in ${r.parts.length} parts` : ""}${r.skipped.length ? `; not included: ${r.skipped.join(", ")}` : ""}`);
    if (r.parts.length === 1) { const w = window.open(r.parts[0]!.url, "_blank"); if (w) w.opener = null; }
  }, "Bundle ready (links valid for 10 minutes)");
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-6 border-b border-line pb-1 text-sm font-semibold uppercase tracking-wide text-accent">{children}</h2>;
  return (
    <>
      <Card title="Report settings" className="mb-5 print:hidden">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Quick period"><Select value="" onChange={(e) => { const p = P.find((x) => x.id === e.target.value); if (p) { setFrom(p.from); setTo(p.to); } }}><option value="">Choose…</option>{P.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Report title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
          <Field label="Categories (leave empty for everything)"><MultiSelect options={os.recordCategories} value={cats} onChange={setCats} placeholder="All categories" /></Field>
          <Field label="Include">
            <div className="space-y-1 text-sm">{PARTS.map((p) => <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={has(p.id)} onChange={(e) => setParts(e.target.checked ? [...parts, p.id] : parts.filter((x) => x !== p.id))} />{p.label}</label>)}</div>
          </Field>
        </div>
        {cats.length > 0 && <p className="mt-2 text-xs text-muted">With categories chosen, orders and duties are included only if they carry one of them; meetings are left out.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>Print / save report as PDF</Button>
          <Button variant="soft" disabled={bundle.busy} onClick={makeBundle}>{bundle.busy ? "Building bundle…" : "Download evidence bundle (one PDF)"}</Button>
        </div>
        <ErrorText>{bundle.error}</ErrorText><Notice>{bundle.done}</Notice>{bundleInfo && <p className="text-xs text-muted">{bundleInfo}</p>}
        {bundleParts.length > 1 && <ul className="mt-2 space-y-1 text-sm">{bundleParts.map((p, i) => <li key={p.url}><a className="text-accent underline" href={p.url} target="_blank" rel="noopener noreferrer">Open part {i + 1}</a> <span className="text-xs text-muted">{p.label.replace(/^Part \d+ · /, "")} · {Math.round(p.sizeKb / 102.4) / 10} MB</span></li>)}</ul>}
      </Card>

      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 print:max-w-none print:border-0 print:p-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm">{owner}{cv.data?.designation && `, ${cv.data.designation}`}{(cv.data?.institution || ss.settings.institution) && `, ${cv.data?.institution || ss.settings.institution}`}</p>
        <p className="text-xs text-muted">Period: {formatDate(from)} – {formatDate(to)}{cats.length ? ` · Categories: ${cats.join(", ")}` : ""} · Generated {formatDate(today)}</p>

        <H>Summary</H>
        <table className="mt-2 w-full text-sm"><tbody>
          {has("teaching") && <tr className="border-b border-line/60"><td className="py-1">Teaching sessions / hours</td><td className="text-right">{T.reduce((t, x) => t + x.sessions, 0)} / {Math.round(T.reduce((t, x) => t + x.minutes, 0) / 6) / 10}</td></tr>}
          {has("records") && byCat.map(({ c, list }) => <tr key={c} className="border-b border-line/60"><td className="py-1">{c}</td><td className="text-right">{list.length}</td></tr>)}
          {has("orders") && <tr className="border-b border-line/60"><td className="py-1">Office orders</td><td className="text-right">{O.length}</td></tr>}
          {has("duties") && <tr className="border-b border-line/60"><td className="py-1">Duties completed</td><td className="text-right">{D.length}</td></tr>}
          {has("meetings") && !cats.length && <tr><td className="py-1">Meetings</td><td className="text-right">{M.length}</td></tr>}
        </tbody></table>
        {has("records") && R.some((r) => r.categories.length > 1) && <p className="mt-1 text-xs text-muted">A record with several categories is counted under each.</p>}

        {has("teaching") && T.length > 0 && <>
          <H>Teaching</H>
          <table className="mt-2 w-full text-sm"><thead className="text-left text-xs text-muted"><tr><th>Semester</th><th>Subject</th><th className="text-right">Sessions</th><th className="text-right">Hours</th><th>Units</th></tr></thead>
            <tbody>{T.map((x) => <tr key={`${x.semesterId}-${x.subjectId}`} className="border-t border-line/60"><td className="py-1">{x.semester}</td><td>{x.label}</td><td className="text-right">{x.sessions}</td><td className="text-right">{Math.round(x.minutes / 6) / 10}</td><td className="text-xs">{x.units.join(", ")}</td></tr>)}</tbody></table>
        </>}

        {has("records") && byCat.map(({ c, list }) => (
          <section key={c}><H>{c}</H>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">{list.map((r) => <li key={r.id}><span className="font-medium">{r.title}</span>{[r.role, r.organisation, r.level, r.amount].filter(Boolean).map((x) => `, ${x}`).join("")} <span className="text-muted">({formatDate(r.date)}{r.endDate && ` – ${formatDate(r.endDate)}`})</span>{r.details && <span className="block text-xs text-muted">{r.details}</span>}{r.files.length > 0 && <span className="text-xs text-muted"> [{r.files.length} document(s)]</span>}</li>)}</ol>
          </section>
        ))}

        {has("orders") && O.length > 0 && <><H>Office orders</H>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">{O.map((o) => <li key={o.id}>{o.number && `${o.number}, `}{formatDate(o.date)}: <span className="font-medium">{o.title}</span>{o.type && ` (${o.type})`}{o.mention && <span className="block text-xs text-muted">{o.mention}</span>}</li>)}</ol></>}

        {has("duties") && D.length > 0 && <><H>Duties completed</H>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">{D.map((d) => <li key={d.id}><span className="font-medium">{d.title}</span>{d.assignedBy && `, assigned by ${d.assignedBy}`} <span className="text-muted">(completed {formatDate(d.doneOn)})</span>{d.outcome && <span className="block text-xs text-muted">{d.outcome}</span>}</li>)}</ol></>}

        {has("meetings") && M.length > 0 && <><H>Meetings</H>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{M.map((m) => <li key={m.id}>{formatDate(m.date)}: {m.title}{m.type && ` (${m.type})`}</li>)}</ol></>}
      </article>
    </>
  );
}
