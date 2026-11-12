"use client";
import { useState } from "react";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useMilestones } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { daysBetween, formatDate, todayInTz } from "@/lib/domain/dates";
import { degreeProgress, isOverdue } from "@/lib/domain/milestones";
import type { Milestone, ScholarDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Progress, Select, Spinner, Textarea, useAction } from "../ui";
import { statusLabel, statusTone } from "../scholar-bits";

function Timeline({ ms, joining, today }: { ms: Milestone[]; joining: string; today: string }) {
  if (!ms.length) return null;
  const last = ms.reduce((mx, m) => (m.dueDate > mx ? m.dueDate : mx), today > joining ? today : joining);
  const span = Math.max(1, daysBetween(joining, last));
  const pos = (d: string) => `${Math.min(100, Math.max(0, (daysBetween(joining, d) / span) * 100))}%`;
  return (
    <div className="relative mb-2 mt-6 h-14" aria-hidden>
      <div className="absolute left-0 right-0 top-6 h-1 rounded bg-canvas" />
      <div className="absolute top-6 h-1 rounded bg-accent/40" style={{ left: 0, width: pos(today) }} />
      <div className="absolute top-3 h-7 w-0.5 bg-accent" style={{ left: pos(today) }} title="Today" />
      {ms.map((m) => (
        <div
          key={m.id}
          title={`${m.title} — ${formatDate(m.dueDate)} (${statusLabel[m.status]})`}
          className={`absolute top-[18px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white shadow ${m.status === "approved" ? "bg-ok" : isOverdue(m, today) ? "bg-bad" : m.status === "submitted" ? "bg-accent" : "bg-gray-300"}`}
          style={{ left: pos(m.dueDate) }}
        />
      ))}
      <div className="absolute top-10 text-xs text-muted" style={{ left: 0 }}>{formatDate(joining)}</div>
      <div className="absolute right-0 top-10 text-xs text-muted">{formatDate(last)}</div>
    </div>
  );
}

function EditMilestone({ uid, m, onClose }: { uid: string; m: Milestone | null; onClose: () => void }) {
  const [f, setF] = useState({
    title: m?.title ?? "", weight: m?.weight ?? 5, dueDate: m?.dueDate ?? "", status: m?.status ?? "not_started",
    completedOn: m?.completedOn ?? "", remarks: m?.remarks ?? "",
  });
  const a = useAction();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await a.run(() =>
      m ? api(`/api/scholars/${uid}/milestones/${m.id}`, "PATCH", f) : api(`/api/scholars/${uid}/milestones`, "POST", { title: f.title, weight: f.weight, dueDate: f.dueDate }),
    );
    if (ok) onClose();
  }
  async function remove() {
    if (!m || !confirm(`Delete milestone "${m.title}"? This is recorded in the audit log.`)) return;
    const ok = await a.run(() => api(`/api/scholars/${uid}/milestones/${m.id}`, "DELETE"));
    if (ok) onClose();
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date"><Input type="date" required value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        <Field label="Weight" hint="Share of degree progress"><Input type="number" min={0} max={100} value={f.weight} onChange={(e) => setF({ ...f, weight: Number(e.target.value) })} /></Field>
      </div>
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Milestone["status"] })}>
                {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Completed on"><Input type="date" value={f.completedOn} onChange={(e) => setF({ ...f, completedOn: e.target.value })} /></Field>
          </div>
          <Field label="Remarks (visible to the scholar)"><Textarea value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
        </>
      )}
      <ErrorText>{a.error}</ErrorText>
      <div className="flex justify-between">
        <Button type="submit" disabled={a.busy}>Save</Button>
        {m && <Button type="button" variant="ghost" className="text-bad" onClick={remove}>Delete</Button>}
      </div>
    </form>
  );
}

function SubmitMilestone({ uid, m, onClose }: { uid: string; m: Milestone; onClose: () => void }) {
  const [note, setNote] = useState(m.scholarNote ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const a = useAction();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await a.run(async () => {
      const evidence = [];
      for (const f of files) evidence.push({ path: await uploadFile(uid, f), name: f.name.slice(0, 200) });
      await api(`/api/scholars/${uid}/milestones/${m.id}/submit`, "POST", { scholarNote: note, evidence });
    });
    if (ok) onClose();
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm">Submit <b>{m.title}</b> for your supervisor&apos;s approval.</p>
      <Field label="Note"><Textarea required value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="Evidence (PDF or image, max 10 MB each)">
        <Input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))} />
      </Field>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Submitting…" : "Submit"}</Button>
    </form>
  );
}

export function Degree({ scholar }: { scholar: ScholarDoc }) {
  const s = useSession();
  const { data, loading, error } = useMilestones(scholar.uid);
  const [edit, setEdit] = useState<Milestone | "new" | null>(null);
  const [submitting, setSubmitting] = useState<Milestone | null>(null);
  const gen = useAction();
  const today = todayInTz(s.settings.timezone);
  const ms = [...data].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.order - b.order);
  const pct = degreeProgress(ms);
  const sup = s.role === "supervisor" && !scholar.deletion;
  const isSelf = s.role === "scholar" && s.user?.uid === scholar.uid;

  if (loading) return <Spinner />;
  return (
    <Card title={`Degree progress · ${pct}%`} action={sup && <Button variant="ghost" onClick={() => setEdit("new")}>Add milestone</Button>}>
      <Progress value={pct} />
      <Timeline ms={ms} joining={scholar.joiningDate} today={today} />
      <ErrorText>{error || gen.error}</ErrorText>
      {!ms.length ? (
        <div className="py-6 text-center">
          <Empty>No milestones yet.</Empty>
          {sup && <Button variant="soft" disabled={gen.busy} onClick={() => gen.run(() => api(`/api/scholars/${scholar.uid}/milestones/generate`, "POST"))}>Create from programme template</Button>}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line/60">
          {ms.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <Badge tone={statusTone(m.status)}>{statusLabel[m.status]}</Badge>
                  {isOverdue(m, today) && <Badge tone="bad">Overdue</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Due {formatDate(m.dueDate)}{m.completedOn && ` · completed ${formatDate(m.completedOn)}`} · weight {m.weight}
                </p>
                {m.scholarNote && <p className="mt-1 text-sm"><span className="text-muted">Scholar:</span> {m.scholarNote}</p>}
                {m.remarks && <p className="mt-1 text-sm"><span className="text-muted">Supervisor:</span> {m.remarks}</p>}
                {m.evidence?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {m.evidence.map((ev) => (
                      <button key={ev.path} className="text-xs text-accent hover:underline" onClick={() => openFile(ev.path).catch((e: Error) => alert(e.message))}>📎 {ev.name}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {isSelf && (m.status === "not_started" || m.status === "in_progress" || m.status === "submitted") && (
                  <Button variant="soft" onClick={() => setSubmitting(m)}>{m.status === "submitted" ? "Add more" : "Submit"}</Button>
                )}
                {sup && m.status === "submitted" && (
                  <Button variant="soft" onClick={() => gen.run(() => api(`/api/scholars/${scholar.uid}/milestones/${m.id}`, "PATCH", { status: "approved" }))}>Approve</Button>
                )}
                {sup && <Button variant="ghost" onClick={() => setEdit(m)}>Edit</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Add milestone" : "Edit milestone"}>
        {edit !== null && <EditMilestone uid={scholar.uid} m={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      </Modal>
      <Modal open={submitting !== null} onClose={() => setSubmitting(null)} title="Submit milestone">
        {submitting && <SubmitMilestone uid={scholar.uid} m={submitting} onClose={() => setSubmitting(null)} />}
      </Modal>
    </Card>
  );
}
