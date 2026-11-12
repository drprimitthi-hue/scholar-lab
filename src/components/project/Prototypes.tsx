"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { usePrototypes, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { DEFAULT_STAGES, TRL_LABEL, bomTotal, stageProgress } from "@/lib/domain/outputs";
import type { ProjectDoc, PrototypeDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Progress, Select, Textarea, useAction } from "@/components/ui";

export const STAGE_TONE = { open: "neutral", submitted: "warn", approved: "ok", revise: "bad" } as const;

export function PrototypeForm({ project, onDone }: { project: ProjectDoc; onDone: (id: string) => void }) {
  const ss = useSession();
  const scholars = useScholars();
  const me = ss.user?.uid ?? "";
  const [f, setF] = useState({ title: "", goal: "", stages: DEFAULT_STAGES.join("\n"), currency: "INR", ownerUids: ss.role === "scholar" ? [me] : [] as string[] });
  const a = useAction();
  const team = scholars.data.filter((x) => project.scholarUids.includes(x.uid));
  return (
    <div className="space-y-3">
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Goal / what it must do"><Textarea value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
      <Field label="Stage gates (one per line)" hint="Each stage is approved before the next can be submitted"><Textarea rows={5} value={f.stages} onChange={(e) => setF({ ...f, stages: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Owners">
          <div className="space-y-1 rounded-lg border border-line p-2 text-sm">
            {team.map((x) => <label key={x.uid} className="flex items-center gap-2"><input type="checkbox" disabled={ss.role === "scholar" && x.uid === me} checked={f.ownerUids.includes(x.uid)} onChange={(e) => setF({ ...f, ownerUids: e.target.checked ? [...f.ownerUids, x.uid] : f.ownerUids.filter((u) => u !== x.uid) })} />{x.name}</label>)}
            {ss.role === "scholar" && <p className="text-xs text-muted">The supervisor can add co-owners.</p>}
          </div>
        </Field>
        <Field label="Currency for the BOM"><Input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
      </div>
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.title.length < 3 || !f.ownerUids.length} onClick={() => a.run(async () => {
        const r = await api<{ id: string }>(`/api/projects/${project.id}/prototypes`, "POST", { ...f, stages: f.stages.split("\n").map((x) => x.trim()).filter(Boolean) });
        onDone(r.id);
      })}>Create prototype</Button>
    </div>
  );
}

function Tile({ p }: { p: PrototypeDoc }) {
  const pct = stageProgress(p.stages);
  const next = p.stages.find((s) => s.status !== "approved");
  return (
    <Link href={`/projects/${p.projectId}/prototypes/${p.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-accent/50">
      <div className="flex items-start justify-between gap-2"><p className="font-medium">{p.title}</p>{p.status !== "active" && <Badge>{p.status}</Badge>}</div>
      <p className="mt-1 text-xs text-muted">{p.ownerNames.join(", ")}</p>
      <div className="mt-3 flex items-center gap-2"><Progress value={pct} /><span className="text-xs">{pct}%</span></div>
      <div className="mt-2 flex flex-wrap gap-1">{p.stages.map((s) => <Badge key={s.name} tone={STAGE_TONE[s.status]}>{s.name}</Badge>)}</div>
      <p className="mt-2 text-xs text-muted">{next ? `Next: ${next.name}${next.status === "submitted" ? " (awaiting review)" : ""}` : "All stages approved"} · {p.trl ? `TRL ${p.trl}` : "TRL not set"} · BOM {p.currency} {bomTotal(p.bom).toLocaleString("en-IN")}</p>
    </Link>
  );
}

export function Prototypes({ project }: { project: ProjectDoc }) {
  const ss = useSession();
  const router = useRouter();
  const { data, error } = usePrototypes(project.id);
  const [add, setAdd] = useState(false);
  const [show, setShow] = useState("active");
  const list = data.filter((p) => show === "all" || p.status === show).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <Card title="Prototypes" action={<div className="flex gap-2"><Select className="py-1 text-xs" value={show} onChange={(e) => setShow(e.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option><option value="all">All</option></Select>{ss.role !== "alumni" && <Button variant="soft" onClick={() => setAdd(true)}>New prototype</Button>}</div>}>
        <ErrorText>{error}</ErrorText>
        {!list.length ? <Empty>No prototypes yet.</Empty> : <div className="grid gap-3 md:grid-cols-2">{list.map((p) => <Tile key={p.id} p={p} />)}</div>}
        <p className="mt-3 text-xs text-muted">TRL scale: 1 {TRL_LABEL[1]} → 9 {TRL_LABEL[9]}.</p>
      </Card>
      <Modal open={add} onClose={() => setAdd(false)} title="New prototype">{add && <PrototypeForm project={project} onDone={(id) => { setAdd(false); router.push(`/projects/${project.id}/prototypes/${id}`); }} />}</Modal>
    </>
  );
}
