"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { doc } from "firebase/firestore";
import { fs } from "@/lib/client/firebase";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useLiveDoc } from "@/lib/client/hooks";
import { useScholars, useScores, useTasks } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { averageScores } from "@/lib/domain/concepts";
import { formatDate } from "@/lib/domain/dates";
import type { Rubric, SessionDoc, Speaker } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Notice, PageHeader, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { SESSION_TYPES, SessionForm } from "@/components/seminar/SessionForm";

const RUBRIC: { key: keyof Rubric; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "depth", label: "Depth" },
  { key: "critical", label: "Critical thinking" },
  { key: "qa", label: "Q&A handling" },
];

function ScoreForm({ sid, sp }: { sid: string; sp: Speaker }) {
  const [r, setR] = useState<Rubric>({ clarity: 3, depth: 3, critical: 3, qa: 3 });
  const [comment, setComment] = useState("");
  const a = useAction();
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-medium">{sp.name}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RUBRIC.map((x) => <Field key={x.key} label={x.label}><Select value={r[x.key]} onChange={(e) => setR({ ...r, [x.key]: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>)}
      </div>
      <Input placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      <Button variant="soft" disabled={a.busy} onClick={() => a.run(() => api(`/api/sessions/${sid}/score`, "POST", { speakerUid: sp.uid, scores: r, comment }), "Score saved (you can change it)")}>Save score</Button>
    </div>
  );
}

function SpeakerCard({ s, sp }: { s: SessionDoc; sp: Speaker }) {
  const ss = useSession();
  const a = useAction();
  const mine = ss.user?.uid === sp.uid && ss.role === "scholar";
  const late = s.status === "scheduled" && !sp.slidesPath && s.date <= new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-medium">{sp.name}</p><p className="text-sm text-muted">{sp.topic || "Topic to be announced"}</p></div>
        {sp.slidesPath ? <Button variant="ghost" className="px-3 py-1" onClick={() => openFile(sp.slidesPath).catch((e: Error) => alert(e.message))}>Open slides</Button> : <Badge tone={late ? "bad" : "neutral"}>{late ? "Slides missing" : "No slides yet"}</Badge>}
      </div>
      {mine && s.status === "scheduled" && (
        <label className="mt-3 block text-xs text-muted">{sp.slidesPath ? "Replace slides (PDF)" : "Upload your slides (PDF, before the session)"}
          <Input type="file" accept="application/pdf" className="mt-1" onChange={(e) => { const f = e.target.files?.[0]; if (f) void a.run(async () => { const path = await uploadFile(ss.user!.uid, f); await api(`/api/sessions/${s.id}/slides`, "PUT", { path }); }, "Slides attached"); }} />
        </label>
      )}
      {sp.spotCheck.length > 0 && <div className="mt-3 rounded-lg bg-canvas p-3 text-xs"><p className="mb-1 font-medium">Spot-check: be ready to explain</p><ul className="list-disc pl-4">{sp.spotCheck.map((c) => <li key={c.cardId}>{c.title}</li>)}</ul></div>}
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
    </div>
  );
}

function Running({ s }: { s: SessionDoc }) {
  const scholars = useScholars();
  const tasks = useTasks({});
  const active = scholars.data.filter((x) => !x.deletion).sort((a, b) => a.name.localeCompare(b.name));
  const [att, setAtt] = useState<Record<string, "present" | "absent" | "excused">>(s.attendance);
  const [q, setQ] = useState({ byUid: "", toUid: s.speakerUids[0] ?? "", text: "" });
  const [ai, setAi] = useState({ text: "", ownerUid: "", due: "" });
  const [notes, setNotes] = useState(s.notes);
  const a = useAction();
  const run = (body: object, msg: string) => a.run(() => api(`/api/sessions/${s.id}/run`, "POST", body), msg);
  const taskDone = new Map(tasks.data.map((t) => [t.id, t.done]));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Attendance" action={<Button variant="soft" disabled={a.busy} onClick={() => run({ action: "attendance", attendance: att }, "Attendance saved")}>Save</Button>}>
        <div className="space-y-1">
          {active.map((x) => (
            <div key={x.uid} className="flex items-center justify-between gap-2 text-sm">
              <span>{x.name}</span>
              <Select className="w-32 py-1 text-xs" value={att[x.uid] ?? ""} onChange={(e) => setAtt({ ...att, [x.uid]: e.target.value as "present" })}><option value="">—</option><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></Select>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-5">
        <Card title="Session">
          <div className="flex flex-wrap gap-2">
            {s.status !== "completed" && <Button disabled={a.busy} onClick={() => run({ action: "status", status: "completed" }, "Marked completed")}>Mark completed</Button>}
            {s.status !== "scheduled" && <Button variant="ghost" disabled={a.busy} onClick={() => run({ action: "status", status: "scheduled" }, "Re-opened")}>Re-open</Button>}
            {s.status === "scheduled" && <Button variant="ghost" disabled={a.busy} onClick={() => confirm("Cancel this session?") && run({ action: "status", status: "cancelled" }, "Cancelled")}>Cancel session</Button>}
            {(s.type === "batch_digest" || s.type === "paper") && <Button variant="ghost" disabled={a.busy} onClick={() => run({ action: "spot_check", perSpeaker: 2 }, "Spot-check papers picked")}>Pick spot-check papers</Button>}
          </div>
          {s.type === "concept_talk" && <p className="mt-2 text-xs text-muted">When a concept talk is marked completed, speakers marked present with an accepted note move to “Taught”.</p>}
        </Card>
        <Card title="Record a question">
          <div className="grid grid-cols-2 gap-2">
            <Select value={q.byUid} onChange={(e) => setQ({ ...q, byUid: e.target.value })}><option value="">Asked by…</option>{active.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</Select>
            <Select value={q.toUid} onChange={(e) => setQ({ ...q, toUid: e.target.value })}>{s.speakers.map((x) => <option key={x.uid} value={x.uid}>to {x.name}</option>)}</Select>
          </div>
          <Input className="mt-2" placeholder="Question" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
          <Button className="mt-2" variant="soft" disabled={a.busy || !q.byUid || q.text.length < 3} onClick={async () => { if (await run({ action: "question", ...q }, "Question recorded")) setQ({ ...q, text: "" }); }}>Add</Button>
        </Card>
        <Card title="Action item → becomes a task">
          <Input placeholder="What needs to be done" value={ai.text} onChange={(e) => setAi({ ...ai, text: e.target.value })} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select value={ai.ownerUid} onChange={(e) => setAi({ ...ai, ownerUid: e.target.value })}><option value="">Owner…</option>{active.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</Select>
            <Input type="date" value={ai.due} onChange={(e) => setAi({ ...ai, due: e.target.value })} />
          </div>
          <Button className="mt-2" variant="soft" disabled={a.busy || !ai.ownerUid || ai.text.length < 3} onClick={async () => { if (await run({ action: "action_item", ...ai }, "Task created")) setAi({ text: "", ownerUid: "", due: "" }); }}>Add</Button>
          {s.actionItems.length > 0 && <ul className="mt-3 divide-y divide-line/60 text-sm">{s.actionItems.map((x) => <li key={x.id} className="flex justify-between gap-2 py-1.5"><span>{x.text} <span className="text-muted">— {x.ownerName}{x.due && `, by ${formatDate(x.due)}`}</span></span><Badge tone={taskDone.get(x.taskId) ? "ok" : "warn"}>{taskDone.get(x.taskId) ? "done" : "open"}</Badge></li>)}</ul>}
        </Card>
        <Card title="Minutes / notes"><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /><Button className="mt-2" variant="soft" disabled={a.busy} onClick={() => run({ action: "notes", notes }, "Notes saved")}>Save notes</Button></Card>
        <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      </div>
    </div>
  );
}

export default function SessionPage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = use(params);
  const ss = useSession();
  const router = useRouter();
  const { data: s, loading, error } = useLiveDoc<SessionDoc>(() => doc(fs(), "sessions", sid), `session:${sid}`);
  const scores = useScores({ sessionId: sid });
  const [edit, setEdit] = useState(false);
  const del = useAction();
  if (loading) return <Spinner />;
  if (!s) return <ErrorText>{error ?? "Session not found."}</ErrorText>;
  const me = ss.user?.uid ?? "";
  const chair = ss.role === "supervisor" || ss.role === "mentor";
  const canScore = s.status !== "cancelled" && (chair || (ss.role === "scholar" && s.peerScoring && s.attendance[me] === "present"));
  return (
    <>
      <PageHeader title={s.title} subtitle={`${SESSION_TYPES[s.type]} · ${formatDate(s.date)}${s.time ? ` · ${s.time}` : ""}${s.venue ? ` · ${s.venue}` : ""}`}
        action={<div className="flex items-center gap-2"><Badge tone={s.status === "completed" ? "ok" : s.status === "cancelled" ? "neutral" : "accent"}>{s.status}</Badge>
          {ss.role === "supervisor" && <><Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button><Button variant="ghost" className="text-bad" onClick={async () => { if (confirm("Delete this session?") && (await del.run(() => api(`/api/sessions/${sid}`, "DELETE")))) router.push("/seminars"); }}>Delete</Button></>}</div>} />
      <ErrorText>{del.error}</ErrorText>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Speakers" className="lg:col-span-2">
          {!s.speakers.length ? <Empty>No speakers.</Empty> : <div className="space-y-3">{s.speakers.map((sp) => <SpeakerCard key={sp.uid} s={s} sp={sp} />)}</div>}
          {s.notes && <p className="mt-4 whitespace-pre-wrap border-t border-line pt-3 text-sm text-muted">{s.notes}</p>}
        </Card>
        <Card title="Scores">
          {s.speakers.map((sp) => {
            const mine = scores.data.filter((x) => x.uid === sp.uid);
            if (!mine.length) return null;
            const avg = averageScores(mine);
            return (
              <div key={sp.uid} className="mb-3 border-b border-line/60 pb-3 text-sm last:border-0">
                <p className="font-medium">{sp.name} · <span className="text-accent">{avg.overall.toFixed(1)}/5</span> <span className="text-xs text-muted">({avg.n} rating{avg.n > 1 ? "s" : ""})</span></p>
                <p className="text-xs text-muted">{RUBRIC.map((r) => `${r.label} ${avg[r.key].toFixed(1)}`).join(" · ")}</p>
                {mine.filter((x) => x.comment).map((x) => <p key={x.id} className="mt-1 text-xs">“{x.comment}” <span className="text-muted">— {x.raterRole === "peer" ? "a peer" : x.raterName || x.raterRole}</span></p>)}
              </div>
            );
          })}
          {!scores.data.length && <p className="text-sm text-muted">{ss.role === "scholar" ? "Your scores appear here once given." : "No scores yet."}</p>}
        </Card>
      </div>
      {canScore && (
        <Card title="Score the talks" className="mt-5">
          <p className="mb-3 text-xs text-muted">1 = needs a lot of work · 5 = excellent.{ss.role === "scholar" && " Peer scores are anonymous."}</p>
          <div className="grid gap-3 md:grid-cols-2">{s.speakers.filter((sp) => sp.uid !== me).map((sp) => <ScoreForm key={sp.uid} sid={sid} sp={sp} />)}</div>
        </Card>
      )}
      {s.questions.length > 0 && (
        <Card title="Questions asked" className="mt-5">
          <ul className="divide-y divide-line/60 text-sm">{s.questions.map((q) => <li key={q.id} className="py-2"><span className="font-medium">{q.byName}</span> → {s.speakers.find((x) => x.uid === q.toUid)?.name}: {q.text}</li>)}</ul>
        </Card>
      )}
      {chair && <div className="mt-5"><Running key={s.updatedAt} s={s} /></div>}
      {!chair && s.actionItems.length > 0 && (
        <Card title="Action items" className="mt-5"><ul className="text-sm">{s.actionItems.map((x) => <li key={x.id}>{x.text} — {x.ownerName}{x.due && `, by ${formatDate(x.due)}`}</li>)}</ul></Card>
      )}
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit session">{edit && <SessionForm session={s} onDone={() => setEdit(false)} />}</Modal>
    </>
  );
}
