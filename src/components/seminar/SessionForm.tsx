"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useProjects, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { todayInTz } from "@/lib/domain/dates";
import type { SessionDoc, SessionType } from "@/lib/types";
import { Button, ErrorText, Field, Input, Select, Textarea, useAction } from "../ui";
import { useConcepts } from "@/lib/client/data";

export const SESSION_TYPES: Record<SessionType, string> = {
  batch_digest: "Reading batch digest",
  concept_talk: "Concept talk",
  paper: "Paper deep-dive",
  prototype_demo: "Prototype demo",
  writing: "Writing review",
  pitch: "Idea / patent / product pitch",
  rehearsal: "Review rehearsal",
  other: "Other",
};

type SpeakerIn = { uid: string; topic: string; conceptId: string; projectId: string };

function ConceptSelect({ projectId, value, onChange }: { projectId: string; value: string; onChange: (v: string) => void }) {
  const c = useConcepts(projectId);
  return <Select className="text-xs" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Concept…</option>{c.data.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Select>;
}

export function SessionForm({ session, onDone }: { session?: SessionDoc; onDone: (id?: string) => void }) {
  const s = useSession();
  const scholars = useScholars();
  const projects = useProjects();
  const [f, setF] = useState({
    title: session?.title ?? "", type: session?.type ?? ("paper" as SessionType), date: session?.date ?? todayInTz(s.settings.timezone), time: session?.time ?? "",
    venue: session?.venue ?? "", peerScoring: session?.peerScoring ?? true, notes: session?.notes ?? "",
  });
  const [speakers, setSpeakers] = useState<SpeakerIn[]>(session?.speakers.map(({ uid, topic, conceptId, projectId }) => ({ uid, topic, conceptId, projectId })) ?? []);
  const a = useAction();
  const active = scholars.data.filter((x) => !x.deletion).sort((x, y) => x.name.localeCompare(y.name));
  const upd = (i: number, p: Partial<SpeakerIn>) => setSpeakers(speakers.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      let id: string | undefined;
      const body = { ...f, speakers };
      if (await a.run(async () => { if (session) await api(`/api/sessions/${session.id}`, "PATCH", body); else id = (await api<{ id: string }>("/api/sessions", "POST", body)).id; })) onDone(id);
    }}>
      <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SessionType })}>{Object.entries(SESSION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Venue / link"><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field>
      </div>
      <Field label="Speakers">
        <div className="space-y-2">
          {speakers.map((sp, i) => (
            <div key={i} className="space-y-1 rounded-lg border border-line p-2">
              <div className="flex gap-2">
                <Select value={sp.uid} onChange={(e) => upd(i, { uid: e.target.value })}><option value="">Scholar…</option>{active.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</Select>
                <Button type="button" variant="ghost" onClick={() => setSpeakers(speakers.filter((_, j) => j !== i))}>✕</Button>
              </div>
              <Input placeholder="Topic" value={sp.topic} onChange={(e) => upd(i, { topic: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select className="text-xs" value={sp.projectId} onChange={(e) => upd(i, { projectId: e.target.value, conceptId: "" })}><option value="">Project (optional)…</option>{projects.data.filter((p) => !sp.uid || p.scholarUids.includes(sp.uid)).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select>
                {f.type === "concept_talk" && sp.projectId ? <ConceptSelect projectId={sp.projectId} value={sp.conceptId} onChange={(v) => upd(i, { conceptId: v })} /> : <span />}
              </div>
            </div>
          ))}
          <Button type="button" variant="ghost" disabled={speakers.length >= 12} onClick={() => setSpeakers([...speakers, { uid: "", topic: "", conceptId: "", projectId: "" }])}>Add speaker</Button>
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.peerScoring} onChange={(e) => setF({ ...f, peerScoring: e.target.checked })} />Scholars who attend may score each talk (anonymously)</label>
      <Field label="Notes / agenda"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy || speakers.some((x) => !x.uid)}>{session ? "Save" : "Create session"}</Button>
    </form>
  );
}

export function RotaForm({ onDone }: { onDone: () => void }) {
  const s = useSession();
  const scholars = useScholars();
  const [f, setF] = useState({ title: "Lab seminar", type: "paper" as SessionType, startDate: todayInTz(s.settings.timezone), everyDays: 7, count: 8, perSession: 2, time: "", venue: "", peerScoring: true });
  const [uids, setUids] = useState<string[]>([]);
  const a = useAction();
  const active = scholars.data.filter((x) => !x.deletion).sort((x, y) => x.name.localeCompare(y.name));
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api("/api/sessions/rota", "POST", { ...f, uids }))) onDone(); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Series title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SessionType })}>{Object.entries(SESSION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="First session"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="Every (days)"><Input type="number" min={1} max={60} value={f.everyDays} onChange={(e) => setF({ ...f, everyDays: Number(e.target.value) })} /></Field>
        <Field label="Number of sessions"><Input type="number" min={1} max={52} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) })} /></Field>
        <Field label="Speakers per session"><Input type="number" min={1} max={8} value={f.perSession} onChange={(e) => setF({ ...f, perSession: Number(e.target.value) })} /></Field>
        <Field label="Time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Venue / link"><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field>
      </div>
      <Field label="Scholars in the rota (in speaking order)">
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {active.map((x) => <label key={x.uid} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={uids.includes(x.uid)} onChange={(e) => setUids(e.target.checked ? [...uids, x.uid] : uids.filter((u) => u !== x.uid))} />{x.name}{uids.includes(x.uid) && <span className="text-xs text-muted">#{uids.indexOf(x.uid) + 1}</span>}</label>)}
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.peerScoring} onChange={(e) => setF({ ...f, peerScoring: e.target.checked })} />Allow anonymous peer scoring</label>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy || !uids.length}>Create {f.count} sessions</Button>
    </form>
  );
}
