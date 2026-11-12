"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useOutput } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { KIND_LABEL, PIPELINES, TRL_LABEL, canMove, isLocked, isPublishable, stepOf } from "@/lib/domain/outputs";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Notice, PageHeader, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { OutputForm } from "@/components/output/OutputForm";
import { statusTone } from "@/components/output/bits";
import { Reauth } from "@/components/Reauth";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (!v) return null;
  return <div className="grid grid-cols-3 gap-2 py-1.5 text-sm"><dt className="text-muted">{k}</dt><dd className="col-span-2 break-words">{v}</dd></div>;
}

export default function OutputPage({ params }: { params: Promise<{ oid: string }> }) {
  const { oid } = use(params);
  const ss = useSession();
  const router = useRouter();
  const { data: o, loading, error } = useOutput(oid);
  const [edit, setEdit] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [reauth, setReauth] = useState(false);
  const a = useAction();
  const fa = useAction();
  if (loading) return <Spinner />;
  if (!o) return <ErrorText>{error ?? "Output not found."}</ErrorText>;
  const role = ss.role!;
  const sup = role === "supervisor";
  const editor = role !== "alumni" && (sup || !isLocked(o.kind, o.status));
  const targets = PIPELINES[o.kind].filter((s) => canMove(role, o.kind, o.status, s.id));
  const steps = PIPELINES[o.kind].filter((s) => s.id !== "rejected" || o.status === "rejected");
  const cur = steps.findIndex((s) => s.id === o.status);
  const publishable = isPublishable(o.kind, o.status, true);
  const del = () => a.run(async () => { await api(`/api/outputs/${oid}`, "DELETE"); router.push("/outputs"); });
  return (
    <>
      <PageHeader title={o.title} subtitle={`${KIND_LABEL[o.kind]}${o.subtype ? ` · ${o.subtype}` : ""}${o.projectTitle ? ` · ${o.projectTitle}` : ""}`}
        action={<div className="flex items-center gap-2">
          <Badge tone={statusTone(o.kind, o.status)}>{stepOf(o.kind, o.status)?.label}</Badge>
          {o.archived && <Badge>archived</Badge>}
          {editor && <Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button>}
        </div>} />
      <Card title="Progress" className="mb-5">
        <ol className="flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <li key={s.id} className={`rounded-full border px-3 py-1 text-xs ${i === cur ? "border-accent bg-accent text-white" : i < cur ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted"}`}>{s.label}</li>
          ))}
        </ol>
        {targets.length > 0 && !o.archived && (
          <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
            <Field label="Move to"><Select value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Note"><Input value={note} placeholder="e.g. submitted via portal, reviewer comments due…" onChange={(e) => setNote(e.target.value)} /></Field>
            <Button disabled={!to || a.busy} onClick={async () => { if (await a.run(() => api(`/api/outputs/${oid}/status`, "POST", { status: to, note, date }), "Updated")) { setTo(""); setNote(""); setDate(""); } }}>Update</Button>
          </div>
        )}
        {!sup && role !== "alumni" && isLocked(o.kind, o.status) && <p className="mt-3 text-xs text-muted">Confirmed by the supervisor; this record is now locked. You can still attach files.</p>}
        {!sup && !isLocked(o.kind, o.status) && <p className="mt-3 text-xs text-muted">Submission, acceptance, filing and similar steps are confirmed by the supervisor.</p>}
        <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <dl className="divide-y divide-line/60">
            <Row k="Authors / team" v={o.authors} />
            <Row k="Lab members" v={o.memberNames.join(", ")} />
            <Row k="Venue" v={o.venue} />
            <Row k="Year" v={o.year} />
            <Row k="Identifier" v={o.identifier} />
            <Row k="Link" v={o.url && <a className="text-accent underline" href={o.url} target="_blank" rel="noopener noreferrer">{o.url}</a>} />
            <Row k="Key date" v={o.date && formatDate(o.date)} />
            <Row k="TRL" v={o.trl > 0 && `TRL ${o.trl} — ${TRL_LABEL[o.trl]}`} />
            <Row k="Project" v={o.projectId && <Link className="text-accent" href={`/projects/${o.projectId}`}>{o.projectTitle}</Link>} />
            <Row k="Notes" v={o.notes && <span className="whitespace-pre-wrap">{o.notes}</span>} />
          </dl>
        </Card>
        <div className="space-y-5">
          <Card title="Files">
            {!o.files.length ? <p className="text-sm text-muted">No files yet.</p> : (
              <ul className="space-y-1 text-sm">{o.files.map((f) => <li key={f.path}><button className="text-left text-accent hover:underline" onClick={() => openFile(f.path).catch((e: Error) => alert(e.message))}>{f.name}</button> <span className="text-xs text-muted">{new Date(f.at).toLocaleDateString("en-GB")}</span></li>)}</ul>
            )}
            {(role === "scholar" || sup) && (
              <label className="mt-3 block text-xs text-muted">Attach a PDF or image (manuscript, acceptance letter, filing receipt, certificate)
                <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="mt-1" onChange={(e) => {
                  const file = e.target.files?.[0]; e.target.value = "";
                  if (file) void fa.run(async () => { const path = await uploadFile(ss.user!.uid, file); await api(`/api/outputs/${oid}/files`, "POST", { file: { path, name: file.name.slice(0, 200) } }); }, "File attached");
                }} />
              </label>
            )}
            <ErrorText>{fa.error}</ErrorText><Notice>{fa.done}</Notice>
          </Card>
          {sup && (
            <Card title="Lab website">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.public} onChange={(e) => a.run(() => api(`/api/outputs/${oid}`, "PATCH", { public: e.target.checked }))} /> Show on the website</label>
              <p className="mt-2 text-xs text-muted">{o.public ? (publishable ? (o.kind === "publication" || o.kind === "patent" ? "Listed on the Publications page now." : "Visible (announced in News).") : "Will appear automatically once it reaches an accepted/granted/released step.") : "Private."}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button variant="ghost" onClick={() => a.run(() => api(`/api/outputs/${oid}`, "PATCH", { archived: !o.archived }))}>{o.archived ? "Restore" : "Archive"}</Button>
                {!o.public && !o.history.length && !o.files.length && <Button variant="ghost" className="text-bad" onClick={() => confirm("Delete this mistaken entry permanently?") && setReauth(true)}>Delete</Button>}
              </div>
            </Card>
          )}
          <Card title="History">
            {!o.history.length ? <p className="text-sm text-muted">Registered {new Date(o.createdAt).toLocaleDateString("en-GB")}.</p> : (
              <ol className="space-y-2 text-sm">{[...o.history].reverse().map((h, i) => (
                <li key={i}><span className="font-medium">{stepOf(o.kind, h.to)?.label ?? h.to}</span> <span className="text-xs text-muted">· {new Date(h.at).toLocaleDateString("en-GB")} · {h.byName}</span>{h.note && <p className="text-xs text-muted">{h.note}</p>}</li>
              ))}</ol>
            )}
          </Card>
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit output">{edit && <OutputForm output={o} onDone={() => setEdit(false)} />}</Modal>
      <Modal open={reauth} onClose={() => setReauth(false)} title="Confirm it’s you">{reauth && <Reauth label="Confirm and delete" onDone={() => { setReauth(false); void del(); }} />}</Modal>
    </>
  );
}
