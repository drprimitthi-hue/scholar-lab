"use client";
import { use, useState } from "react";
import Link from "next/link";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useOutputs, useProject, usePrototype, usePrototypeLog, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { TRL_LABEL, bomTotal, canSubmitStage, stageProgress } from "@/lib/domain/outputs";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import type { BomItem, FileRef, PrototypeDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Notice, PageHeader, Progress, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { STAGE_TONE } from "@/components/project/Prototypes";

const Files = ({ files }: { files: FileRef[] }) =>
  files.length ? <ul className="mt-1 flex flex-wrap gap-2 text-xs">{files.map((f) => <li key={f.path}><button className="text-accent hover:underline" onClick={() => openFile(f.path).catch((e: Error) => alert(e.message))}>{f.name}</button></li>)}</ul> : null;

function useUploads() {
  const ss = useSession();
  const [files, setFiles] = useState<{ path: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = (
    <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="mt-1" disabled={busy} onChange={async (e) => {
      const f = e.target.files?.[0]; e.target.value = "";
      if (!f) return;
      setBusy(true); setErr(null);
      try { const path = await uploadFile(ss.user!.uid, f); setFiles((x) => [...x, { path, name: f.name.slice(0, 200) }]); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    }} />
  );
  const list = files.length ? <p className="text-xs text-muted">Attached: {files.map((f) => f.name).join(", ")}</p> : null;
  return { files, reset: () => setFiles([]), input, list, busy, err };
}

function Stages({ p, owner, reviewer, sup }: { p: PrototypeDoc; owner: boolean; reviewer: boolean; sup: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [evidence, setEvidence] = useState("");
  const [comments, setComments] = useState<Record<number, string>>({});
  const up = useUploads();
  const a = useAction();
  const base = `/api/projects/${p.projectId}/prototypes/${p.id}/gate`;
  return (
    <ol className="space-y-3">
      {p.stages.map((s, i) => (
        <li key={s.name} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{i + 1}. {s.name}</p>
            <Badge tone={STAGE_TONE[s.status]}>{s.status === "open" ? "not started" : s.status}</Badge>
          </div>
          {s.evidence && <p className="mt-2 whitespace-pre-wrap text-sm">{s.evidence}</p>}
          <Files files={s.files} />
          {s.comment && <p className="mt-2 rounded-lg bg-canvas p-2 text-xs"><span className="font-medium">Review:</span> {s.comment}</p>}
          {owner && canSubmitStage(p.stages, i) && p.status === "active" && (open === i ? (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <Textarea placeholder="What was done, how it was tested, results, what remains…" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
              <label className="block text-xs text-muted">Evidence files (optional){up.input}</label>{up.list}<ErrorText>{up.err}</ErrorText>
              <Button disabled={a.busy || up.busy || evidence.trim().length < 10} onClick={async () => { if (await a.run(() => api(base, "POST", { index: i, evidence, files: up.files }), "Submitted for review")) { setOpen(null); setEvidence(""); up.reset(); } }}>Submit stage</Button>
            </div>
          ) : <Button variant="soft" className="mt-3" onClick={() => { setOpen(i); setEvidence(s.evidence); }}>{s.status === "revise" ? "Revise and resubmit" : "Submit this stage"}</Button>)}
          {reviewer && s.status === "submitted" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Input className="flex-1" placeholder="Comment (required to send back)" value={comments[i] ?? ""} onChange={(e) => setComments({ ...comments, [i]: e.target.value })} />
              <Button disabled={a.busy} onClick={() => a.run(() => api(base, "PATCH", { index: i, decision: "approved", comment: comments[i] ?? "" }), "Stage approved")}>Approve</Button>
              <Button variant="ghost" disabled={a.busy || (comments[i] ?? "").trim().length < 5} onClick={() => a.run(() => api(base, "PATCH", { index: i, decision: "revise", comment: comments[i] ?? "" }), "Sent back")}>Send back</Button>
            </div>
          )}
          {sup && s.status === "approved" && <button className="mt-2 text-xs text-muted underline" onClick={() => confirm(`Re-open “${s.name}”?`) && a.run(() => api(base, "PATCH", { index: i, decision: "reopen", comment: "Re-opened" }), "Re-opened")}>Re-open</button>}
        </li>
      ))}
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
    </ol>
  );
}

function Bom({ p, canEdit }: { p: PrototypeDoc; canEdit: boolean }) {
  const [rows, setRows] = useState<BomItem[]>(p.bom);
  const a = useAction();
  const dirty = JSON.stringify(rows) !== JSON.stringify(p.bom);
  const upd = (i: number, k: keyof BomItem, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "qty" || k === "unitCost" ? Number(v) || 0 : v } : r)));
  return (
    <Card title={`Bill of materials · total ${p.currency} ${bomTotal(rows).toLocaleString("en-IN")}`} action={canEdit && <Button variant="soft" onClick={() => setRows([...rows, { id: Math.random().toString(36).slice(2, 12) || "x1", item: "", qty: 1, unitCost: 0, supplier: "", status: "needed" }])}>Add line</Button>}>
      {!rows.length ? <Empty>No components listed.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Item</th><th>Qty</th><th>Unit cost</th><th>Supplier</th><th>Status</th><th className="text-right">Line total</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-line/60">
                  {canEdit ? <>
                    <td className="py-1 pr-1"><Input className="py-1" value={r.item} onChange={(e) => upd(i, "item", e.target.value)} /></td>
                    <td className="pr-1"><Input className="w-16 py-1" type="number" min={1} value={r.qty} onChange={(e) => upd(i, "qty", e.target.value)} /></td>
                    <td className="pr-1"><Input className="w-24 py-1" type="number" min={0} step="0.01" value={r.unitCost} onChange={(e) => upd(i, "unitCost", e.target.value)} /></td>
                    <td className="pr-1"><Input className="py-1" value={r.supplier} onChange={(e) => upd(i, "supplier", e.target.value)} /></td>
                    <td className="pr-1"><Select className="py-1" value={r.status} onChange={(e) => upd(i, "status", e.target.value)}><option value="needed">needed</option><option value="ordered">ordered</option><option value="received">received</option></Select></td>
                  </> : <><td className="py-1.5">{r.item}</td><td>{r.qty}</td><td>{r.unitCost}</td><td>{r.supplier}</td><td><Badge tone={r.status === "received" ? "ok" : r.status === "ordered" ? "warn" : "neutral"}>{r.status}</Badge></td></>}
                  <td className="text-right">{(r.qty * r.unitCost).toLocaleString("en-IN")}</td>
                  {canEdit && <td className="pl-1"><button aria-label="Remove line" className="text-muted hover:text-bad" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && dirty && <Button className="mt-3" disabled={a.busy || rows.some((r) => !r.item.trim())} onClick={() => a.run(() => api(`/api/projects/${p.projectId}/prototypes/${p.id}`, "PATCH", { bom: rows }), "BOM saved")}>Save BOM</Button>}
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
    </Card>
  );
}

function Logbook({ p, canWrite, tz }: { p: PrototypeDoc; canWrite: boolean; tz: string }) {
  const { data } = usePrototypeLog(p.projectId, p.id);
  const today = todayInTz(tz);
  const [f, setF] = useState({ date: today, hours: 1, text: "" });
  const up = useUploads();
  const a = useAction();
  const entries = [...data].sort((x, y) => y.date.localeCompare(x.date) || y.at - x.at);
  const hours = data.reduce((t, e) => t + e.hours, 0);
  return (
    <Card title={`Logbook · ${entries.length} entries · ${hours} h`}>
      {canWrite && (
        <div className="mb-4 space-y-2 rounded-xl border border-line p-3">
          <div className="grid grid-cols-2 gap-2"><Field label="Date"><Input type="date" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="Hours"><Input type="number" min={0} max={24} step="0.5" value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} /></Field></div>
          <Textarea placeholder="What did you do, observe or measure? What went wrong? Next step?" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          <label className="block text-xs text-muted">Photo or PDF (optional){up.input}</label>{up.list}<ErrorText>{up.err}</ErrorText>
          <Button variant="soft" disabled={a.busy || up.busy || f.text.trim().length < 5} onClick={async () => { if (await a.run(() => api(`/api/projects/${p.projectId}/prototypes/${p.id}/log`, "POST", { ...f, files: up.files }), "Entry added")) { setF({ ...f, text: "" }); up.reset(); } }}>Add entry</Button>
          <p className="text-xs text-muted">Entries are permanent and can be back-dated up to 7 days.</p>
          <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
        </div>
      )}
      {!entries.length ? <Empty>No entries yet.</Empty> : (
        <ol className="space-y-3">{entries.map((e) => <li key={e.id} className="border-l-2 border-accent/30 pl-3 text-sm"><p className="text-xs text-muted">{formatDate(e.date)} · {e.name} · {e.hours} h</p><p className="whitespace-pre-wrap">{e.text}</p><Files files={e.files} /></li>)}</ol>
      )}
    </Card>
  );
}

function Settings({ p, team, canOwners, onDone }: { p: PrototypeDoc; team: { uid: string; name: string }[]; canOwners: boolean; onDone: () => void }) {
  const outputs = useOutputs();
  const [f, setF] = useState({ title: p.title, goal: p.goal, demoUrl: p.demoUrl, repoUrl: p.repoUrl, outputId: p.outputId });
  const [owners, setOwners] = useState(p.ownerUids.filter((u) => team.some((t) => t.uid === u)));
  // Owners this user cannot see (another mentor's mentees) are always kept.
  const allOwners = [...p.ownerUids.filter((u) => !team.some((t) => t.uid === u) && !u.startsWith("deleted-")), ...owners];
  const a = useAction();
  return (
    <div className="space-y-3">
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Goal"><Textarea value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
      <Field label="Demo video link" hint="YouTube/Drive link; keeps large videos out of storage"><Input value={f.demoUrl} placeholder="https://…" onChange={(e) => setF({ ...f, demoUrl: e.target.value })} /></Field>
      <Field label="Code repository link"><Input value={f.repoUrl} placeholder="https://…" onChange={(e) => setF({ ...f, repoUrl: e.target.value })} /></Field>
      <Field label="Linked output (product or software)"><Select value={f.outputId} onChange={(e) => setF({ ...f, outputId: e.target.value })}><option value="">— none —</option>{outputs.data.filter((o) => o.kind === "product" || o.kind === "software").map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</Select></Field>
      {canOwners && (
        <Field label="Owners">
          <div className="space-y-1 rounded-lg border border-line p-2 text-sm">{team.map((x) => <label key={x.uid} className="flex items-center gap-2"><input type="checkbox" checked={owners.includes(x.uid)} onChange={(e) => setOwners(e.target.checked ? [...owners, x.uid] : owners.filter((u) => u !== x.uid))} />{x.name}</label>)}</div>
        </Field>
      )}
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || (canOwners && !allOwners.length)} onClick={async () => { if (await a.run(() => api(`/api/projects/${p.projectId}/prototypes/${p.id}`, "PATCH", canOwners && JSON.stringify(allOwners) !== JSON.stringify(p.ownerUids) ? { ...f, ownerUids: allOwners } : f))) onDone(); }}>Save</Button>
    </div>
  );
}

export default function PrototypePage({ params }: { params: Promise<{ pid: string; prid: string }> }) {
  const { pid, prid } = use(params);
  const ss = useSession();
  const project = useProject(pid);
  const { data: p, loading, error } = usePrototype(pid, prid);
  const scholars = useScholars();
  const [edit, setEdit] = useState(false);
  const a = useAction();
  if (loading || project.loading) return <Spinner />;
  if (!p || !project.data) return <ErrorText>{error ?? project.error ?? "Prototype not found."}</ErrorText>;
  const me = ss.user?.uid ?? "";
  const sup = ss.role === "supervisor";
  const mentor = ss.role === "mentor" && project.data.mentorUids.includes(me);
  const owner = ss.role === "scholar" && p.ownerUids.includes(me);
  const worker = sup || mentor || owner;
  const patch = (body: object, msg: string) => a.run(() => api(`/api/projects/${pid}/prototypes/${prid}`, "PATCH", body), msg);
  return (
    <>
      <PageHeader title={p.title} subtitle={`${project.data.title} · ${p.ownerNames.join(", ")}`}
        action={<div className="flex items-center gap-2"><Link href={`/projects/${pid}?tab=prototypes`} className="text-sm text-muted hover:text-accent">All prototypes</Link>{worker && <Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button>}</div>} />
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Summary" className="lg:col-span-2">
          {p.goal && <p className="mb-3 whitespace-pre-wrap text-sm">{p.goal}</p>}
          <div className="flex items-center gap-3"><Progress value={stageProgress(p.stages)} /><span className="text-sm font-medium">{stageProgress(p.stages)}%</span></div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {p.demoUrl && <a className="text-accent underline" href={p.demoUrl} target="_blank" rel="noopener noreferrer">Demo video</a>}
            {p.repoUrl && <a className="text-accent underline" href={p.repoUrl} target="_blank" rel="noopener noreferrer">Code repository</a>}
            {p.outputId && <Link className="text-accent underline" href={`/outputs/${p.outputId}`}>Linked output</Link>}
          </div>
        </Card>
        <Card title="Readiness">
          {sup || mentor ? (
            <div className="space-y-2">
              <Field label="TRL"><Select value={p.trl} onChange={(e) => patch({ trl: Number(e.target.value) }, "TRL updated")}>{TRL_LABEL.map((l, i) => <option key={i} value={i}>{i ? `TRL ${i} — ${l}` : "Not set"}</option>)}</Select></Field>
              <Field label="Status"><Select value={p.status} onChange={(e) => patch({ status: e.target.value }, "Status updated")}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></Select></Field>
            </div>
          ) : <p className="text-sm">{p.trl ? `TRL ${p.trl} — ${TRL_LABEL[p.trl]}` : "TRL not set yet"} · <Badge>{p.status}</Badge></p>}
          <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Stage gates"><Stages p={p} owner={owner || sup} reviewer={sup || mentor} sup={sup} /></Card>
        <Logbook p={p} canWrite={worker && p.status !== "done"} tz={ss.settings.timezone} />
      </div>
      <div className="mt-5"><Bom key={JSON.stringify(p.bom)} p={p} canEdit={worker} /></div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit prototype">{edit && <Settings p={p} team={scholars.data.filter((x) => project.data!.scholarUids.includes(x.uid))} canOwners={sup || mentor} onDone={() => setEdit(false)} />}</Modal>
    </>
  );
}
