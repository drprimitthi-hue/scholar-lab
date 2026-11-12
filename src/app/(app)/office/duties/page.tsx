"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDuties } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { dutyIcs, dutyState, type DutyState } from "@/lib/domain/office";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import type { DutyDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, Modal, PageHeader, Spinner } from "@/components/ui";
import { DutyForm } from "@/components/office/Forms";
import { Cats, FileList } from "@/components/office/bits";

const GROUPS: { id: DutyState[]; title: string }[] = [
  { id: ["overdue"], title: "Overdue" }, { id: ["today"], title: "Due today" }, { id: ["soon"], title: "Coming up (inside the reminder window)" },
  { id: ["later"], title: "Later / no deadline" }, { id: ["done", "dropped"], title: "Completed or dropped" },
];

function downloadIcs(d: DutyDoc) {
  const blob = new Blob([dutyIcs(d)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `duty-${d.deadline}.ics`; a.click(); URL.revokeObjectURL(a.href);
}

export default function DutiesPage() {
  const ss = useSession();
  const today = todayInTz(ss.settings.timezone);
  const focus = useSearchParams().get("id");
  const { data, loading } = useDuties();
  const [form, setForm] = useState<DutyDoc | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);
  const rows = data.map((d) => ({ d, ...dutyState(d, today) }));
  const sortKey = (x: (typeof rows)[number]) => (x.d.status === "open" ? x.d.deadline || "9999" : `~${x.d.doneOn}`);
  return (
    <>
      <PageHeader title="Duties" subtitle="Deadlines with reminders; add any duty to your phone calendar for alerts" action={<Button onClick={() => setForm("new")}>Add duty</Button>} />
      {loading ? <Spinner /> : !data.length ? <Card><Empty>No duties yet.</Empty></Card> : (
        <div className="space-y-5">{GROUPS.map((g) => {
          const list = rows.filter((x) => g.id.includes(x.state)).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
          if (!list.length) return null;
          const closed = g.id.includes("done");
          if (closed && !showDone) return <button key={g.title} className="text-sm text-accent" onClick={() => setShowDone(true)}>Show {list.length} completed/dropped</button>;
          return (
            <Card key={g.title} title={`${g.title} (${list.length})`}>
              <ul className="divide-y divide-line/60">{list.map(({ d, state, daysLeft }) => (
                <li key={d.id} className={`py-3 ${focus === d.id ? "rounded-lg bg-accent/5 px-2" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted">{[d.assignedBy && `by ${d.assignedBy}`, d.assignedOn && `on ${formatDate(d.assignedOn)}`, d.source.label && `from ${d.source.label}`].filter(Boolean).join(" · ")}
                        {d.source.type && <> · <Link className="underline" href={d.source.type === "order" ? `/office/orders/${d.source.id}` : `/office/meetings/${d.source.id}`}>open</Link></>}</p>
                      {d.details && <p className="mt-1 whitespace-pre-wrap text-sm">{d.details}</p>}
                      {d.outcome && <p className="mt-1 text-sm text-muted">Outcome: {d.outcome}</p>}
                      {d.categories.length > 0 && <div className="mt-1"><Cats list={d.categories} /></div>}
                      <div className="mt-1"><FileList files={d.files} /></div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {d.status === "open" ? (d.deadline ? <Badge tone={state === "overdue" ? "bad" : state === "today" ? "warn" : state === "soon" ? "accent" : "neutral"}>{formatDate(d.deadline)}{daysLeft !== null && (daysLeft < 0 ? ` · ${-daysLeft} d late` : daysLeft === 0 ? " · today" : ` · ${daysLeft} d`)}</Badge> : <Badge>no deadline</Badge>)
                        : <Badge tone={d.status === "done" ? "ok" : "neutral"}>{d.status}{d.doneOn && ` ${formatDate(d.doneOn)}`}</Badge>}
                      <div className="flex gap-2 text-xs">
                        {d.status === "open" && d.deadline && <button className="text-accent" onClick={() => downloadIcs(d)}>Add to calendar</button>}
                        {d.status === "open" && <button className="text-accent" onClick={async () => { const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = d; void _i; void _c; void _u; await api(`/api/office/duties/${d.id}`, "PUT", { ...rest, status: "done", doneOn: today }).catch((e: Error) => alert(e.message)); }}>Mark done</button>}
                        <button className="text-muted hover:text-accent" onClick={() => setForm(d)}>Edit</button>
                        <button className="text-muted hover:text-bad" onClick={async () => { if (confirm("Delete this duty?")) await api(`/api/office/duties/${d.id}`, "DELETE").catch((e: Error) => alert(e.message)); }}>Delete</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}</ul>
            </Card>
          );
        })}</div>
      )}
      <p className="mt-4 text-xs text-muted">“Add to calendar” downloads a calendar file with your reminder days; open it on your phone or computer so alerts come from your own calendar. Reminders also show on My Office → Today and on your dashboard.</p>
      <Modal open={!!form} onClose={() => setForm(null)} title={form === "new" ? "New duty" : "Edit duty"}>{form && <DutyForm d={form === "new" ? undefined : form} onDone={() => setForm(null)} />}</Modal>
    </>
  );
}
