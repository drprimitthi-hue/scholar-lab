"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCards, useConceptNotes, useOutputs, useProjects, usePrototypes } from "@/lib/client/data";
import { KIND_LABEL, stepOf } from "@/lib/domain/outputs";
import { Badge, Button, Card, Empty, ErrorText, PageHeader, Select, Spinner, Tabs, Textarea, useAction } from "@/components/ui";
import { CardView } from "@/components/project/CardView";
import { NoteView } from "@/components/project/Concepts";
import type { ConceptNote, ReadingCard } from "@/lib/types";

function ReviewItem({ c, project }: { c: ReadingCard; project: string }) {
  const [comment, setComment] = useState("");
  const a = useAction();
  return (
    <Card title={c.itemTitle} action={<div className="flex gap-2"><Badge>{c.scholarName}</Badge><Badge tone="accent">{project}</Badge></div>}>
      <p className="mb-3 text-xs text-muted">Submitted {c.submittedAt ? new Date(c.submittedAt).toLocaleString("en-GB") : ""}{c.history.filter((h) => h.status === "revise").length ? ` · revised ${c.history.filter((h) => h.status === "revise").length}×` : ""}</p>
      <CardView c={c} />
      <div className="mt-4 space-y-2">
        <Textarea rows={2} placeholder="Comment (required when asking for revision)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <ErrorText>{a.error}</ErrorText>
        <div className="flex gap-2">
          <Button disabled={a.busy} onClick={() => a.run(() => api("/api/reading/review", "POST", { cardId: c.id, action: "accept", comment }))}>Accept</Button>
          <Button variant="ghost" disabled={a.busy} onClick={() => a.run(() => api("/api/reading/review", "POST", { cardId: c.id, action: "revise", comment }))}>Ask for revision</Button>
        </div>
      </div>
    </Card>
  );
}

function NoteItem({ n, project }: { n: ConceptNote; project: string }) {
  const [comment, setComment] = useState("");
  const a = useAction();
  return (
    <Card title={n.conceptTitle} action={<div className="flex gap-2"><Badge>{n.scholarName}</Badge><Badge tone="accent">{project}</Badge></div>}>
      <NoteView n={n} />
      <div className="mt-4 space-y-2">
        <Textarea rows={2} placeholder="Comment (required when asking for revision)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <ErrorText>{a.error}</ErrorText>
        <div className="flex gap-2">
          <Button disabled={a.busy} onClick={() => a.run(() => api(`/api/concept-notes/${n.id}/review`, "POST", { action: "accept", comment }))}>Accept (→ Explained)</Button>
          <Button variant="ghost" disabled={a.busy} onClick={() => a.run(() => api(`/api/concept-notes/${n.id}/review`, "POST", { action: "revise", comment }))}>Ask for revision</Button>
        </div>
      </div>
    </Card>
  );
}

/** Outputs a scholar has sent for internal/supervisor review. */
const AWAITING = new Set(["internal_review", "review"]);

function GateList({ pid, title }: { pid: string; title: string }) {
  const { data } = usePrototypes(pid);
  const items = data.flatMap((p) => p.stages.map((st, i) => ({ p, st, i })).filter((x) => x.st.status === "submitted"));
  if (!items.length) return null;
  return (
    <>{items.map(({ p, st, i }) => (
      <li key={`${p.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span><Link className="font-medium hover:text-accent" href={`/projects/${pid}/prototypes/${p.id}`}>{p.title}</Link> — stage “{st.name}” <span className="text-xs text-muted">· {title} · {p.ownerNames.join(", ")}</span></span>
        <Badge tone="warn">submitted {st.submittedAt ? new Date(st.submittedAt).toLocaleDateString("en-GB") : ""}</Badge>
      </li>
    ))}</>
  );
}

export default function ReviewPage() {
  const cards = useCards({ status: "submitted" });
  const notes = useConceptNotes({ status: "submitted" });
  const projects = useProjects();
  const outputs = useOutputs();
  const waiting = outputs.data.filter((o) => !o.archived && AWAITING.has(o.status)).sort((a, b) => a.updatedAt - b.updatedAt);
  const [pid, setPid] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "cards";
  if (cards.loading || notes.loading) return <Spinner />;
  const names = new Map(projects.data.map((p) => [p.id, p.title]));
  const list = cards.data.filter((c) => !pid || c.projectId === pid).sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
  return (
    <>
      <PageHeader title="Review queue" subtitle={`${cards.data.length} Reading Card(s) · ${notes.data.length} Concept Note(s) waiting · oldest first`}
        action={<Select className="w-64" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">All projects</option>{projects.data.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select>} />
      <Tabs tabs={[{ id: "cards", label: `Reading Cards (${cards.data.length})` }, { id: "notes", label: `Concept Notes (${notes.data.length})` }, { id: "outputs", label: `Outputs & stage gates (${waiting.length}+)` }]} value={tab} onChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })} />
      <ErrorText>{cards.error || notes.error}</ErrorText>
      {tab === "outputs" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Outputs sent for review">
            {!waiting.length ? <Empty>None waiting.</Empty> : <ul className="divide-y divide-line/60">{waiting.map((o) => (
              <li key={o.id} className="py-2 text-sm"><Link className="font-medium hover:text-accent" href={`/outputs/${o.id}`}>{o.title}</Link>
                <p className="text-xs text-muted">{KIND_LABEL[o.kind]} · {stepOf(o.kind, o.status)?.label} · {o.memberNames.join(", ")} · since {new Date(o.updatedAt).toLocaleDateString("en-GB")}</p></li>
            ))}</ul>}
          </Card>
          <Card title="Prototype stages awaiting approval">
            <ul className="divide-y divide-line/60">{projects.data.filter((p) => !pid || p.id === pid).map((p) => <GateList key={p.id} pid={p.id} title={p.title} />)}</ul>
            <p className="mt-2 text-xs text-muted">Open a prototype to approve or send back a stage.</p>
          </Card>
        </div>
      ) : tab === "cards" ? (!list.length ? <Card><Empty>Nothing to review. 👍</Empty></Card> : <div className="space-y-4">{list.map((c) => <ReviewItem key={c.id} c={c} project={names.get(c.projectId) ?? ""} />)}</div>)
        : (() => { const nl = notes.data.filter((n) => !pid || n.projectId === pid).sort((a, b) => a.updatedAt - b.updatedAt); return !nl.length ? <Card><Empty>No concept notes waiting.</Empty></Card> : <div className="space-y-4">{nl.map((n) => <NoteItem key={n.id} n={n} project={names.get(n.projectId) ?? ""} />)}</div>; })()}
    </>
  );
}
