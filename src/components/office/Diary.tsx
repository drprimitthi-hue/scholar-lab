"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useDiary, useOfficeSettings, useSemesters } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { activeSemester, defaultTimes, slotDone, slotsOn, subjectLabel } from "@/lib/domain/office";
import { addDays, todayInTz } from "@/lib/domain/dates";
import type { DiaryEntry, DiaryType, SemesterDoc, Subject } from "@/lib/types";
import { Badge, Button, ErrorText, Field, Input, Modal, Notice, Select, Textarea, useAction } from "@/components/ui";
import { nowHHMM } from "./bits";

export const TYPE_LABEL: Record<DiaryType, string> = { lecture: "Lecture", lab: "Lab", tutorial: "Tutorial", meeting: "Meeting", duty: "Duty", other: "Other" };
export type DiaryDraft = Omit<DiaryEntry, "id" | "createdAt" | "updatedAt" | "subjectLabel">;

export const blankDraft = (date: string, times: { start: string; end: string }, type: DiaryType = "other"): DiaryDraft => ({
  date, start: times.start, end: times.end, type, semesterId: "", subjectId: "", room: "", unit: "", topic: "", remark: "", students: 0,
});

/** Full entry form (used for quick add after picking, and for editing). */
export function DiaryForm({ initial, id, sems, last, onDone }: { initial: DiaryDraft; id?: string; sems: SemesterDoc[]; last?: DiaryEntry; onDone: () => void }) {
  const [f, setF] = useState<DiaryDraft>(initial);
  const a = useAction();
  const sem = sems.find((x) => x.id === f.semesterId);
  const subject = sem?.subjects.find((x) => x.id === f.subjectId);
  const teaching = f.type === "lecture" || f.type === "lab" || f.type === "tutorial";
  const set = <K extends keyof DiaryDraft>(k: K, v: DiaryDraft[K]) => setF({ ...f, [k]: v });
  const save = () => a.run(async () => {
    await api(id ? `/api/office/diary/${id}` : "/api/office/diary", id ? "PUT" : "POST", { ...f, students: Number(f.students) || 0 });
    onDone();
  }, id ? "Saved" : "Added to diary");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="From"><Input type="time" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
        <Field label="To"><Input type="time" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => set("type", e.target.value as DiaryType)}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      </div>
      {teaching && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Semester"><Select value={f.semesterId} onChange={(e) => setF({ ...f, semesterId: e.target.value, subjectId: "" })}><option value="">—</option>{sems.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label="Subject"><Select value={f.subjectId} onChange={(e) => set("subjectId", e.target.value)}><option value="">—</option>{sem?.subjects.map((x) => <option key={x.id} value={x.id}>{subjectLabel(x)}</option>)}</Select></Field>
          <Field label="Unit">{subject && subject.units > 0
            ? <Select value={f.unit} onChange={(e) => set("unit", e.target.value)}><option value="">—</option>{Array.from({ length: subject.units }, (_, i) => `Unit ${i + 1}`).map((u) => <option key={u}>{u}</option>)}</Select>
            : <Input value={f.unit} onChange={(e) => set("unit", e.target.value)} />}</Field>
          <Field label="Room"><Input value={f.room} onChange={(e) => set("room", e.target.value)} /></Field>
        </div>
      )}
      {last && teaching && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Last time ({last.date}): {[last.unit, last.topic].filter(Boolean).join(" — ") || "no topic recorded"}</p>}
      <Field label={teaching ? "Topic taught" : f.type === "meeting" ? "Meeting and key points" : "What"}><Textarea rows={2} autoFocus value={f.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <Field label="Remark"><Input value={f.remark} onChange={(e) => set("remark", e.target.value)} /></Field>
        {teaching && <Field label="Students present"><Input type="number" min={0} value={f.students || ""} onChange={(e) => set("students", Number(e.target.value))} /></Field>}
      </div>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      <Button disabled={a.busy || (!f.topic.trim() && !f.subjectId)} onClick={save}>{id ? "Save" : "Add to diary"}</Button>
    </div>
  );
}

/** Pinned at the top of My Office (and behind the “+ Diary” button): today's classes as one-tap chips. */
export function QuickDiary({ compact }: { compact?: boolean }) {
  const ss = useSession();
  const os = useOfficeSettings();
  const today = todayInTz(ss.settings.timezone);
  const sems = useSemesters();
  const recent = useDiary(addDays(today, -90), today);
  const [draft, setDraft] = useState<{ d: DiaryDraft; last?: DiaryEntry; key: number } | null>(null);
  const sorted = useMemo(() => [...sems.data].sort((a, b) => b.startDate.localeCompare(a.startDate)), [sems.data]);
  const sem = activeSemester(sorted, today);
  const slots = slotsOn(sem, today);
  const lastFor = (sid: string) => recent.data.filter((e) => e.semesterId === sem?.id && e.subjectId === sid).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0];
  const pick = (subject: Subject | null, type: DiaryType, slot?: { start: string; end: string; room: string }) => {
    const times = slot?.start ? { start: slot.start, end: slot.end || defaultTimes(slot.start, os.diaryMinutes).end } : defaultTimes(nowHHMM(), os.diaryMinutes);
    const last = subject ? lastFor(subject.id) : undefined;
    setDraft({
      key: Date.now(), last,
      d: { ...blankDraft(today, times, type), semesterId: subject && sem ? sem.id : "", subjectId: subject?.id ?? "", room: slot?.room ?? last?.room ?? "", unit: last?.unit ?? "" },
    });
  };
  const chip = "rounded-full border px-3 py-1.5 text-sm transition hover:border-accent hover:text-accent";
  return (
    <div className="space-y-3">
      {!sem && <p className="text-sm text-muted">No active semester. <Link href="/office/teaching" className="text-accent underline">Add this semester’s subjects</Link> to get one-tap class entries.</p>}
      {slots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted">Today:</span>
          {slots.map(({ subject, slot }) => {
            const done = slotDone(recent.data, today, subject.id, slot.start);
            return <button key={`${subject.id}-${slot.start}`} onClick={() => pick(subject, subject.kind === "lab" ? "lab" : subject.kind === "tutorial" ? "tutorial" : "lecture", slot)} className={`${chip} ${done ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-white"}`}>{done ? "✓ " : ""}{slot.start} {subject.code || subject.name}{slot.room && ` · ${slot.room}`}</button>;
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {sem && sem.subjects.map((s) => <button key={s.id} onClick={() => pick(s, s.kind === "lab" ? "lab" : s.kind === "tutorial" ? "tutorial" : "lecture")} className={`${chip} border-line bg-white`}>{s.code || s.name}</button>)}
        <button onClick={() => pick(null, "lab")} className={`${chip} border-dashed border-line`}>Lab</button>
        <button onClick={() => pick(null, "meeting")} className={`${chip} border-dashed border-line`}>Meeting</button>
        <button onClick={() => pick(null, "duty")} className={`${chip} border-dashed border-line`}>Duty</button>
        <button onClick={() => pick(null, "other")} className={`${chip} border-dashed border-line`}>Other</button>
      </div>
      {draft && (
        <div className={`rounded-2xl border border-accent/30 bg-accent/5 p-4 ${compact ? "" : "max-w-3xl"}`}>
          <DiaryForm key={draft.key} initial={draft.d} sems={sorted} last={draft.last} onDone={() => setDraft(null)} />
          <button className="mt-2 text-xs text-muted underline" onClick={() => setDraft(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export function EntryRow({ e, onEdit }: { e: DiaryEntry; onEdit: () => void }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm"><span className="font-medium tabular-nums">{e.start}{e.end && `–${e.end}`}</span> <Badge tone={e.type === "meeting" ? "accent" : e.type === "lecture" || e.type === "lab" || e.type === "tutorial" ? "ok" : "neutral"}>{TYPE_LABEL[e.type]}</Badge> {e.subjectLabel && <span className="font-medium">{e.subjectLabel}</span>}</p>
        <p className="text-sm">{[e.unit, e.topic].filter(Boolean).join(" — ")}</p>
        <p className="text-xs text-muted">{[e.room && `Room ${e.room}`, e.students ? `${e.students} students` : "", e.remark].filter(Boolean).join(" · ")}</p>
      </div>
      <button className="shrink-0 text-xs text-muted hover:text-accent" onClick={onEdit}>Edit</button>
    </li>
  );
}

export function EditEntry({ e, onClose }: { e: DiaryEntry | null; onClose: () => void }) {
  const sems = useSemesters();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!e} onClose={onClose} title="Edit diary entry">
      {e && <>
        <DiaryForm id={e.id} initial={e} sems={sems.data} onDone={onClose} />
        <button className="mt-4 text-xs text-bad underline" disabled={busy} onClick={async () => { if (!confirm("Delete this entry?")) return; setBusy(true); try { await api(`/api/office/diary/${e.id}`, "DELETE"); onClose(); } catch (x) { alert((x as Error).message); } finally { setBusy(false); } }}>Delete entry</button>
      </>}
    </Modal>
  );
}

