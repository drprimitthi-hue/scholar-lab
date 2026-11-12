"use client";
import { useState } from "react";
import { useOfficeSettings, useRecords } from "@/lib/client/office";
import { formatDate } from "@/lib/domain/dates";
import type { RecordDoc } from "@/lib/types";
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { RecordForm } from "@/components/office/Forms";
import { Cats, FileList, MultiSelect } from "@/components/office/bits";

export default function RecordsPage() {
  const os = useOfficeSettings();
  const { data, loading } = useRecords();
  const [cats, setCats] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<RecordDoc | "new" | null>(null);
  const years = [...new Set(data.map((r) => r.date.slice(0, 4)))].sort().reverse();
  const list = data
    .filter((r) => !cats.length || r.categories.some((c) => cats.includes(c)))
    .filter((r) => (!year || r.date.startsWith(year) || r.endDate.startsWith(year)) && (!level || r.level === level))
    .filter((r) => !q || `${r.title} ${r.details} ${r.organisation} ${r.role}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const counts = os.recordCategories.map((c) => ({ c, n: data.filter((r) => r.categories.includes(c)).length })).filter((x) => x.n);
  return (
    <>
      <PageHeader title="Records & achievements" subtitle={`${list.length} of ${data.length}`} action={<Button onClick={() => setForm("new")}>Add record</Button>} />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <Field label="Categories (any of)"><MultiSelect options={os.recordCategories} value={cats} onChange={setCats} placeholder="All categories" /></Field>
          <Field label="Year"><Select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All</option>{years.map((y) => <option key={y}>{y}</option>)}</Select></Field>
          <Field label="Level"><Select value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All</option>{os.levels.map((l) => <option key={l}>{l}</option>)}</Select></Field>
          <Field label="Search"><Input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        </div>
        {counts.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{counts.map(({ c, n }) => <button key={c} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])} className={`rounded-full border px-2.5 py-0.5 text-xs ${cats.includes(c) ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"}`}>{c} · {n}</button>)}</div>}
      </Card>
      {loading ? <Spinner /> : !list.length ? <Card><Empty>No records match.</Empty></Card> : (
        <Card><ul className="divide-y divide-line/60">{list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-muted">{formatDate(r.date)}{r.endDate && ` – ${formatDate(r.endDate)}`}{[r.level, r.role, r.organisation, r.amount].filter(Boolean).map((x) => ` · ${x}`).join("")}</p>
              <div className="mt-1"><Cats list={r.categories} /></div>
              {r.details && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.details}</p>}
              <div className="mt-1"><FileList files={r.files} /></div>
            </div>
            <div className="flex gap-3 text-xs"><button className="text-muted hover:text-accent" onClick={() => setForm(r)}>Edit</button>
              <button className="text-muted hover:text-bad" onClick={async () => { if (confirm("Delete this record?")) { const { api } = await import("@/lib/client/api"); await api(`/api/office/records/${r.id}`, "DELETE").catch((e: Error) => alert(e.message)); } }}>Delete</button></div>
          </li>
        ))}</ul></Card>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form === "new" ? "Add record" : "Edit record"}>{form && <RecordForm r={form === "new" ? undefined : form} onDone={() => setForm(null)} />}</Modal>
    </>
  );
}
