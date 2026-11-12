"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useCards, useLiterature, usePlans, useProjects } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import { cardProblems, releasedBatches, wordCount } from "@/lib/domain/literature";
import type { CardFields, LitItem, ProjectDoc, ReadingCard } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { CardView } from "@/components/project/CardView";
import { cardTone } from "@/components/project/Plans";

const EMPTY: CardFields = { problem: "", method: "", setup: "", keyResult: "", limitations: "", concepts: ["", "", ""], relevance: 3, citableClaim: "" };

function CardForm({ project, item, card, onDone }: { project: ProjectDoc; item: LitItem; card?: ReadingCard; onDone: () => void }) {
  const [f, setF] = useState<CardFields>(() => ({ ...EMPTY, ...Object.fromEntries(Object.entries(card ?? {}).filter(([k]) => k in EMPTY)), concepts: [...(card?.concepts ?? []), "", "", ""].slice(0, 3) }));
  const a = useAction();
  const set = <K extends keyof CardFields>(k: K, v: CardFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const problems = cardProblems(f, project.minWords);
  const area = (k: "problem" | "method" | "setup" | "keyResult" | "limitations", label: string, hint: string, min = project.minWords) => (
    <Field label={`${label} · ${wordCount(f[k])}${min ? `/${min}` : ""} words`} hint={hint}>
      <Textarea rows={3} value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api("/api/reading/card", "PUT", { projectId: project.id, itemId: item.id, ...f, concepts: f.concepts.map((x) => x.trim()) }))) onDone(); }}>
      {card?.status === "revise" && card.reviewComment && <p className="rounded-lg bg-amber-50 p-3 text-sm text-warn"><b>Revise:</b> {card.reviewComment}</p>}
      {area("problem", "Problem", "What problem does the paper address?")}
      {area("method", "Method", "How do they solve it?")}
      {area("setup", "Hardware / dataset / setup", "Boards, tools, datasets, parameters (optional)", 0)}
      {area("keyResult", "Key result", "Main finding with numbers where possible")}
      {area("limitations", "Limitations", "What is missing or weak? (feeds the gap register)")}
      <Field label="Three key concepts"><div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Input key={i} value={f.concepts[i] ?? ""} onChange={(e) => set("concepts", f.concepts.map((c, j) => (j === i ? e.target.value : c)))} />)}</div></Field>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field label="Relevance"><Select value={f.relevance} onChange={(e) => set("relevance", Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}</Select></Field>
        <Field label="One claim you would cite"><Input value={f.citableClaim} onChange={(e) => set("citableClaim", e.target.value)} /></Field>
      </div>
      {problems.length > 0 && <p className="text-xs text-muted">Still needed: {problems.join(" · ")}</p>}
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy || problems.length > 0}>{a.busy ? "Submitting…" : "Submit for review"}</Button>
    </form>
  );
}

function ProjectReading({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const plans = usePlans(project.id);
  const lit = useLiterature(project.id);
  const cards = useCards({ projectId: project.id });
  const [writing, setWriting] = useState<LitItem | null>(null);
  const [viewing, setViewing] = useState<ReadingCard | null>(null);
  const openA = useAction();
  const today = todayInTz(s.settings.timezone);
  if (plans.loading || lit.loading || cards.loading) return <Spinner />;
  const plan = plans.data[0];
  if (!plan) return <Card title={project.title}><Empty>Your supervisor has not set your reading plan yet.</Empty></Card>;
  const items = new Map(lit.data.map((i) => [i.id, i]));
  const byItem = new Map(cards.data.map((c) => [c.itemId, c]));
  const accepted = new Set(cards.data.filter((c) => c.status === "accepted").map((c) => c.itemId));
  const released = releasedBatches(plan.batches, today, project.releaseMode, project.gateThreshold, accepted);
  const total = plan.batches.reduce((n, b) => n + b.itemIds.length, 0);
  const openBatches = plan.batches.filter((b) => released.has(b.no) && b.itemIds.some((id) => !accepted.has(id)));
  const nextLocked = plan.batches.find((b) => !released.has(b.no));

  async function openPaper(item: LitItem) {
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    const ok = await openA.run(async () => {
      const { url } = await api<{ url: string }>("/api/reading/open", "POST", { projectId: project.id, itemId: item.id });
      if (win) win.location.href = url; else window.location.href = url;
    });
    if (!ok) win?.close();
  }

  return (
    <Card title={<Link href={`/projects/${project.id}`} className="hover:text-accent">{project.title}</Link>} action={<span className="text-xs text-muted">{accepted.size}/{total} accepted</span>}>
      <Progress value={(accepted.size / Math.max(1, total)) * 100} />
      <ErrorText>{openA.error}</ErrorText>
      {!openBatches.length ? (
        <p className="mt-4 text-sm text-muted">{nextLocked ? `All released papers are done. Next batch ${nextLocked.no} opens ${project.releaseMode === "gated" ? "when the current one is accepted" : `on ${formatDate(nextLocked.date)}`}.` : "You have finished this reading list. 🎉"}</p>
      ) : openBatches.map((b) => (
        <div key={b.no} className="mt-5">
          <p className="mb-2 text-sm font-medium">Batch {b.no} · {formatDate(b.date)} {b.date < today && <Badge tone="warn">from earlier</Badge>}{b.date === today && <Badge tone="accent">today</Badge>}</p>
          <ul className="divide-y divide-line/60">
            {b.itemIds.map((id) => {
              const item = items.get(id);
              if (!item) return null;
              const c = byItem.get(id);
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted">{[item.authors, item.venue, item.year].filter(Boolean).join(" · ")} · {item.type} · ~{item.estMinutes} min</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={cardTone(c?.status)}>{c?.status ?? "new"}</Badge>
                    <Button variant="ghost" className="px-3 py-1.5" onClick={() => openPaper(item)}>Open paper</Button>
                    {(!c || c.status === "opened" || c.status === "revise") && <Button className="px-3 py-1.5" onClick={() => setWriting(item)}>{c?.status === "revise" ? "Revise card" : "Write card"}</Button>}
                    {c && (c.status === "submitted" || c.status === "accepted") && <Button variant="soft" className="px-3 py-1.5" onClick={() => setViewing(c)}>View card</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Modal open={writing !== null} onClose={() => setWriting(null)} title={writing?.title ?? ""}>
        {writing && <CardForm project={project} item={writing} card={byItem.get(writing.id)} onDone={() => setWriting(null)} />}
      </Modal>
      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.itemTitle ?? ""}>
        {viewing && <><CardView c={viewing} />{viewing.reviewComment && <p className="mt-3 rounded-lg bg-canvas p-3 text-sm"><span className="text-muted">Reviewer:</span> {viewing.reviewComment}</p>}</>}
      </Modal>
    </Card>
  );
}

export default function ReadingPage() {
  const s = useSession();
  const projects = useProjects();
  if (projects.loading) return <Spinner />;
  const active = projects.data.filter((p) => p.status === "active");
  return (
    <>
      <PageHeader title="Today's reading" subtitle={formatDate(todayInTz(s.settings.timezone))} />
      <ErrorText>{projects.error}</ErrorText>
      {!active.length ? <Card><Empty>No active projects.</Empty></Card> : <div className="space-y-5">{active.map((p) => <ProjectReading key={p.id} project={p} />)}</div>}
    </>
  );
}
