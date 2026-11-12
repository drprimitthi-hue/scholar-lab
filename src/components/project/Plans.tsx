"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useCards, useLiterature, usePlans, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import { releasedBatches } from "@/lib/domain/literature";
import type { PlanDoc, ProjectDoc, ReadingCard } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Notice, Select, Spinner, useAction } from "../ui";

export const cardTone = (st?: ReadingCard["status"]) => (st === "accepted" ? "ok" : st === "submitted" ? "accent" : st === "revise" ? "warn" : "neutral");

function PlanEditor({ project, uid, plan }: { project: ProjectDoc; uid: string; plan?: PlanDoc }) {
  const s = useSession();
  const [mins, setMins] = useState(plan?.dailyMinutes ?? 60);
  const [start, setStart] = useState(plan?.startDate ?? todayInTz(s.settings.timezone));
  const a = useAction();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Daily reading (minutes)"><Input type="number" min={10} max={600} className="w-28" value={mins} onChange={(e) => setMins(Number(e.target.value))} /></Field>
      <Field label="Start date"><Input type="date" className="w-44" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Button disabled={a.busy} onClick={() => a.run(async () => {
        const r = await api<{ batches: number; scheduled: number }>(`/api/projects/${project.id}/plans/${uid}`, "PUT", { dailyMinutes: mins, startDate: start });
        return r;
      }, plan ? "Re-planned from today; past batches kept." : "Plan created.")}>{plan ? "Re-plan" : "Create plan"}</Button>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
    </div>
  );
}

export function Plans({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const plans = usePlans(project.id);
  const lit = useLiterature(project.id);
  const cards = useCards({ projectId: project.id });
  const scholars = useScholars();
  const [openUid, setOpenUid] = useState<string | null>(null);
  const move = useAction();
  const today = todayInTz(s.settings.timezone);
  if (plans.loading || lit.loading) return <Spinner />;
  const titles = new Map(lit.data.map((i) => [i.id, i.title]));
  const members = scholars.data.filter((x) => project.scholarUids.includes(x.uid));
  if (!members.length) return <Card><Empty>No scholars on this project yet.</Empty></Card>;

  return (
    <div className="space-y-4">
      {members.map((sc) => {
        const plan = plans.data.find((p) => p.uid === sc.uid);
        const mine = new Map(cards.data.filter((c) => c.uid === sc.uid).map((c) => [c.itemId, c]));
        const accepted = new Set([...mine.values()].filter((c) => c.status === "accepted").map((c) => c.itemId));
        const released = plan ? releasedBatches(plan.batches, today, project.releaseMode, project.gateThreshold, accepted) : new Set<number>();
        const planned = new Set(plan?.batches.flatMap((b) => b.itemIds) ?? []);
        const unplanned = lit.data.filter((i) => !planned.has(i.id) && !mine.has(i.id)).length;
        const lastDate = plan?.batches.at(-1)?.date;
        return (
          <Card key={sc.uid} title={sc.name} action={plan && <Button variant="ghost" onClick={() => setOpenUid(openUid === sc.uid ? null : sc.uid)}>{openUid === sc.uid ? "Hide batches" : "Show batches"}</Button>}>
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              {plan ? (
                <>
                  <Badge>{plan.batches.length} batches · {plan.dailyMinutes} min/day</Badge>
                  <Badge tone="accent">{released.size} released</Badge>
                  <Badge tone="ok">{accepted.size} accepted</Badge>
                  {lastDate && <Badge>finishes {formatDate(lastDate)}</Badge>}
                  {unplanned > 0 && <Badge tone="warn">{unplanned} new papers not yet planned — re-plan to include</Badge>}
                </>
              ) : <Badge tone="warn">No plan yet</Badge>}
            </div>
            {s.role === "supervisor" && <PlanEditor key={plan?.updatedAt ?? 0} project={project} uid={sc.uid} plan={plan} />}
            {plan && openUid === sc.uid && (
              <div className="mt-5 space-y-3">
                <ErrorText>{move.error}</ErrorText>
                {plan.batches.map((b) => (
                  <div key={b.no} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Batch {b.no} · {formatDate(b.date)}</span>
                      <Badge tone={released.has(b.no) ? "accent" : "neutral"}>{released.has(b.no) ? "released" : "locked"}</Badge>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {b.itemIds.map((id) => (
                        <li key={id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate">{titles.get(id) ?? id}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge tone={cardTone(mine.get(id)?.status)}>{mine.get(id)?.status ?? "not started"}</Badge>
                            {s.role === "supervisor" && (
                              <Select aria-label="Move to batch" className="w-24 py-1 text-xs" value={b.no} onChange={(e) => move.run(() => api(`/api/projects/${project.id}/plans/${sc.uid}`, "PATCH", { itemId: id, toBatch: Number(e.target.value) }))}>
                                {plan.batches.map((x) => <option key={x.no} value={x.no}>→ {x.no}</option>)}
                              </Select>
                            )}
                          </span>
                        </li>
                      ))}
                      {!b.itemIds.length && <li className="text-xs text-muted">Empty</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
