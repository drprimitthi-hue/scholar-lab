"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useOfficeSettings } from "@/lib/client/office";
import { AUTO_SECTIONS, DEFAULT_OFFICE } from "@/lib/domain/office";
import type { OfficeSettings } from "@/lib/types";
import { Button, Card, ErrorText, Field, Input, Notice, PageHeader, Textarea, useAction } from "@/components/ui";

const lines = (s: string) => [...new Set(s.split("\n").map((x) => x.trim()).filter(Boolean))];
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "section";

function Form({ initial }: { initial: OfficeSettings }) {
  const [f, setF] = useState({
    recordCategories: initial.recordCategories.join("\n"), levels: initial.levels.join("\n"), orderTypes: initial.orderTypes.join("\n"),
    meetingTypes: initial.meetingTypes.join("\n"), reminderDays: initial.reminderDays.join(", "), diaryMinutes: String(initial.diaryMinutes),
  });
  const [sections, setSections] = useState(initial.cvSections);
  const a = useAction();
  const L = ({ k, label, hint }: { k: "recordCategories" | "levels" | "orderTypes" | "meetingTypes"; label: string; hint?: string }) => (
    <Field label={label} hint={hint ?? "One per line"}><Textarea rows={8} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
  );
  const save = () => a.run(() => api("/api/office/settings", "PUT", {
    recordCategories: lines(f.recordCategories), levels: lines(f.levels), orderTypes: lines(f.orderTypes), meetingTypes: lines(f.meetingTypes),
    reminderDays: [...new Set(f.reminderDays.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 60))].slice(0, 6),
    diaryMinutes: Number(f.diaryMinutes) || 60,
    cvSections: sections.filter((s) => s.title.trim()),
  }), "Saved");
  return (
    <div className="space-y-5">
      <Card title="Categories for records, orders and duties (used in reports and the evidence bundle)">
        <div className="grid gap-4 md:grid-cols-2">
          {L({ k: "recordCategories", label: "Categories", hint: "One per line. Renaming one does not change records already saved." })}
          <div className="space-y-4">{L({ k: "levels", label: "Levels" })}{L({ k: "orderTypes", label: "Office order types" })}</div>
        </div>
      </Card>
      <Card title="Meetings, reminders and diary">
        <div className="grid gap-4 md:grid-cols-3">
          {L({ k: "meetingTypes", label: "Meeting types" })}
          <Field label="Default reminder days before a deadline" hint="e.g. 7, 2, 0 (0 = on the day)"><Input value={f.reminderDays} onChange={(e) => setF({ ...f, reminderDays: e.target.value })} /></Field>
          <Field label="Default diary entry length (minutes)"><Input type="number" min={15} max={240} value={f.diaryMinutes} onChange={(e) => setF({ ...f, diaryMinutes: e.target.value })} /></Field>
        </div>
      </Card>
      <Card title="CV sections (order as shown)">
        <ul className="space-y-2">{sections.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <Input value={s.title} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <span className="w-40 shrink-0 text-xs text-muted">{AUTO_SECTIONS[s.id] ? "auto + records" : "records"}</span>
            <button className="text-xs" disabled={!i} onClick={() => { const n = [...sections]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; setSections(n); }}>↑</button>
            <button className="text-xs" disabled={i === sections.length - 1} onClick={() => { const n = [...sections]; [n[i + 1], n[i]] = [n[i]!, n[i + 1]!]; setSections(n); }}>↓</button>
            <button className="text-xs text-muted hover:text-bad" onClick={() => setSections(sections.filter((_, j) => j !== i))}>remove</button>
          </li>
        ))}</ul>
        <button className="mt-2 text-sm text-accent" onClick={() => { const t = prompt("New section title"); if (t) { let id = slug(t); while (sections.some((x) => x.id === id)) id = `${id.slice(0, 36)}-${Math.floor(Math.random() * 99)}`; setSections([...sections, { id, title: t }]); } }}>+ Add section</button>
        <button className="ml-4 mt-2 text-sm text-muted underline" onClick={() => setSections(DEFAULT_OFFICE.cvSections)}>Reset to standard sections</button>
      </Card>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      <Button disabled={a.busy} onClick={save}>Save settings</Button>
    </div>
  );
}

export default function OfficeSettingsPage() {
  const os = useOfficeSettings();
  return (
    <>
      <PageHeader title="Office settings" subtitle="Your own lists; nothing is fixed in the software" />
      <Form key={JSON.stringify(os)} initial={os} />
    </>
  );
}
