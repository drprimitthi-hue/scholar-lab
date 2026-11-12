"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { DAYS } from "@/lib/domain/office";
import type { SemesterDoc, Subject } from "@/lib/types";
import { Button, ErrorText, Field, Input, Select, useAction } from "@/components/ui";

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const blankSubject = (): Subject => ({ id: newId(), code: "", name: "", programme: "", kind: "theory", units: 5, slots: [] });

export function SemesterForm({ sem, copyFrom, onDone }: { sem?: SemesterDoc; copyFrom?: SemesterDoc[]; onDone: () => void }) {
  const [f, setF] = useState({ name: sem?.name ?? "", startDate: sem?.startDate ?? "", endDate: sem?.endDate ?? "", active: sem?.active ?? true });
  const [subjects, setSubjects] = useState<Subject[]>(sem?.subjects ?? [blankSubject()]);
  const a = useAction();
  const upd = (i: number, p: Partial<Subject>) => setSubjects(subjects.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Semester name"><Input value={f.name} placeholder="Odd 2026-27" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Starts"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="Ends"><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Current semester</label>
      </div>
      {!sem && copyFrom && copyFrom.length > 0 && (
        <Field label="Start from an earlier semester’s subjects (optional)">
          <Select value="" onChange={(e) => { const src = copyFrom.find((x) => x.id === e.target.value); if (src) setSubjects(src.subjects.map((s) => ({ ...s, id: newId() }))); }}><option value="">—</option>{copyFrom.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        </Field>
      )}
      <div className="space-y-3">
        <p className="text-sm font-medium">Subjects this semester</p>
        {subjects.map((s, i) => (
          <div key={s.id} className="rounded-xl border border-line p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[7rem_1fr_1fr_7rem_5rem_auto]">
              <Input placeholder="Code" value={s.code} onChange={(e) => upd(i, { code: e.target.value })} />
              <Input placeholder="Subject name" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <Input placeholder="Programme / class" value={s.programme} onChange={(e) => upd(i, { programme: e.target.value })} />
              <Select value={s.kind} onChange={(e) => upd(i, { kind: e.target.value as Subject["kind"] })}><option value="theory">Theory</option><option value="lab">Lab</option><option value="tutorial">Tutorial</option></Select>
              <Input type="number" min={0} max={30} title="Number of units" value={s.units} onChange={(e) => upd(i, { units: Number(e.target.value) })} />
              <button className="text-xs text-muted hover:text-bad" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}>remove</button>
            </div>
            <div className="mt-2 space-y-1">
              {s.slots.map((sl, k) => (
                <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                  <Select className="w-24 py-1" value={sl.day} onChange={(e) => upd(i, { slots: s.slots.map((x, m) => (m === k ? { ...x, day: Number(e.target.value) } : x)) })}>{DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</Select>
                  <Input type="time" className="w-28 py-1" value={sl.start} onChange={(e) => upd(i, { slots: s.slots.map((x, m) => (m === k ? { ...x, start: e.target.value } : x)) })} />
                  <span className="text-muted">to</span>
                  <Input type="time" className="w-28 py-1" value={sl.end} onChange={(e) => upd(i, { slots: s.slots.map((x, m) => (m === k ? { ...x, end: e.target.value } : x)) })} />
                  <Input className="w-28 py-1" placeholder="Room" value={sl.room} onChange={(e) => upd(i, { slots: s.slots.map((x, m) => (m === k ? { ...x, room: e.target.value } : x)) })} />
                  <button className="text-xs text-muted hover:text-bad" onClick={() => upd(i, { slots: s.slots.filter((_, m) => m !== k) })}>✕</button>
                </div>
              ))}
              <button className="text-xs text-accent" onClick={() => upd(i, { slots: [...s.slots, { day: 1, start: "", end: "", room: s.slots.at(-1)?.room ?? "" }] })}>+ usual day &amp; time (optional)</button>
            </div>
          </div>
        ))}
        <Button variant="soft" onClick={() => setSubjects([...subjects, blankSubject()])}>Add subject</Button>
        <p className="text-xs text-muted">Days and times are optional; when given, today’s classes appear as one-tap buttons in the diary. Units 0 = free text.</p>
      </div>
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.name.length < 2 || !f.startDate} onClick={() => a.run(async () => {
        await api(sem ? `/api/office/semesters/${sem.id}` : "/api/office/semesters", sem ? "PUT" : "POST", { ...f, subjects: subjects.filter((s) => s.name.trim()).map((s) => ({ ...s, slots: s.slots.filter((x) => x.start) })) });
        onDone();
      })}>{sem ? "Save semester" : "Create semester"}</Button>
    </div>
  );
}
