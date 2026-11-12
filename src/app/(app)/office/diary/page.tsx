"use client";
import { useState } from "react";
import { useDiary } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { minutesBetween } from "@/lib/domain/office";
import { toCsv } from "@/lib/domain/csv";
import { addDays, formatDate, todayInTz } from "@/lib/domain/dates";
import type { DiaryEntry, DiaryType } from "@/lib/types";
import { Button, Card, Empty, ErrorText, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { EditEntry, EntryRow, TYPE_LABEL } from "@/components/office/Diary";

export default function DiaryPage() {
  const ss = useSession();
  const today = todayInTz(ss.settings.timezone);
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<DiaryEntry | null>(null);
  const { data, loading, error } = useDiary(from, to);
  const subjects = [...new Set(data.map((e) => e.subjectLabel).filter(Boolean))].sort();
  const list = data
    .filter((e) => !type || e.type === type)
    .filter((e) => !subject || e.subjectLabel === subject)
    .filter((e) => !q || `${e.topic} ${e.remark} ${e.unit} ${e.room}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const days = [...new Set(list.map((e) => e.date))];
  const hours = Math.round(list.reduce((t, e) => t + minutesBetween(e.start, e.end), 0) / 6) / 10;
  const csv = () => {
    const text = toCsv(["Date", "From", "To", "Type", "Subject", "Unit", "Topic", "Room", "Students", "Remark"], [...list].reverse().map((e) => [e.date, e.start, e.end, TYPE_LABEL[e.type], e.subjectLabel, e.unit, e.topic, e.room, e.students || "", e.remark]));
    const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `diary-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageHeader title="Diary" subtitle={`${list.length} entries · ${hours} h · ${days.length} day(s)`} action={<Button variant="ghost" disabled={!list.length} onClick={csv}>Download CSV</Button>} />
      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All</option>{(Object.keys(TYPE_LABEL) as DiaryType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}</Select></Field>
          <Field label="Subject"><Select value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">All</option>{subjects.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Search"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="topic, remark…" /></Field>
          <Field label="Quick range"><Select value="" onChange={(e) => { const v = e.target.value; if (v === "w") { setFrom(addDays(today, -6)); setTo(today); } if (v === "m") { setFrom(`${today.slice(0, 7)}-01`); setTo(today); } if (v === "y") { setFrom(`${today.slice(0, 4)}-01-01`); setTo(today); } }}><option value="">Choose…</option><option value="w">Last 7 days</option><option value="m">This month</option><option value="y">This year</option></Select></Field>
        </div>
      </Card>
      <ErrorText>{error}</ErrorText>
      {loading ? <Spinner /> : !list.length ? <Card><Empty>No entries in this range.</Empty></Card> : (
        <div className="space-y-4">{days.map((d) => (
          <Card key={d} title={formatDate(d)}><ul className="divide-y divide-line/60">{list.filter((e) => e.date === d).sort((a, b) => a.start.localeCompare(b.start)).map((e) => <EntryRow key={e.id} e={e} onEdit={() => setEdit(e)} />)}</ul></Card>
        ))}</div>
      )}
      <EditEntry e={edit} onClose={() => setEdit(null)} />
    </>
  );
}
