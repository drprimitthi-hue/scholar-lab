"use client";
import Link from "next/link";
import { degreeProgress, isDueSoon, isOverdue } from "@/lib/domain/milestones";
import { formatDate } from "@/lib/domain/dates";
import type { LabSettings, Milestone, ScholarDoc } from "@/lib/types";
import { Badge, Empty, Progress } from "./ui";

export const programmeName = (settings: LabSettings, id: string) => settings.programmes.find((p) => p.id === id)?.name ?? id;

export function statusTone(st: Milestone["status"]): "neutral" | "ok" | "warn" | "accent" {
  return st === "approved" ? "ok" : st === "submitted" ? "accent" : st === "in_progress" ? "warn" : "neutral";
}
export const statusLabel: Record<Milestone["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  waived: "Waived",
};

export function ScholarTable({ scholars, milestones, settings, today }: { scholars: ScholarDoc[]; milestones: Milestone[]; settings: LabSettings; today: string }) {
  if (!scholars.length) return <Empty>No scholars yet.</Empty>;
  const byUid = new Map<string, Milestone[]>();
  milestones.forEach((m) => byUid.set(m.uid, [...(byUid.get(m.uid) ?? []), m]));
  const rows = [...scholars].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4">Scholar</th>
            <th className="py-2 pr-4">Programme</th>
            <th className="py-2 pr-4 w-48">Degree progress</th>
            <th className="py-2 pr-4">Next milestone</th>
            <th className="py-2">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const ms = (byUid.get(s.uid) ?? []).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const next = ms.find((m) => m.status !== "approved" && m.status !== "waived");
            const overdue = ms.filter((m) => isOverdue(m, today)).length;
            const submitted = ms.filter((m) => m.status === "submitted").length;
            const pct = degreeProgress(ms);
            return (
              <tr key={s.uid} className="border-b border-line/60 last:border-0">
                <td className="py-3 pr-4">
                  <Link href={`/scholars/${s.uid}`} className="font-medium hover:text-accent">{s.name}</Link>
                  <div className="text-xs text-muted">{s.enrolmentNo || s.email}</div>
                </td>
                <td className="py-3 pr-4">{programmeName(settings, s.programmeId)}</td>
                <td className="py-3 pr-4"><div className="flex items-center gap-2"><Progress value={pct} /><span className="w-10 text-right text-xs text-muted">{pct}%</span></div></td>
                <td className="py-3 pr-4">{next ? <><div>{next.title}</div><div className="text-xs text-muted">{formatDate(next.dueDate)}</div></> : <span className="text-muted">—</span>}</td>
                <td className="py-3 space-x-1">
                  {s.deletion && <Badge tone="bad">Deletion scheduled</Badge>}
                  {overdue > 0 && <Badge tone="bad">{overdue} overdue</Badge>}
                  {submitted > 0 && <Badge tone="accent">{submitted} to review</Badge>}
                  {!s.deletion && overdue === 0 && submitted === 0 && <Badge>{s.status}</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DueSoonList({ milestones, scholars, today }: { milestones: Milestone[]; scholars: ScholarDoc[]; today: string }) {
  const names = new Map(scholars.map((s) => [s.uid, s.name]));
  const list = milestones
    .filter((m) => names.has(m.uid) && (isOverdue(m, today) || isDueSoon(m, today, 30)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12);
  if (!list.length) return <Empty>Nothing due in the next 30 days.</Empty>;
  return (
    <ul className="divide-y divide-line/60 text-sm">
      {list.map((m) => (
        <li key={`${m.uid}-${m.id}`} className="flex items-center justify-between gap-3 py-2">
          <div>
            <Link href={`/scholars/${m.uid}?tab=degree`} className="font-medium hover:text-accent">{m.title}</Link>
            <div className="text-xs text-muted">{names.get(m.uid)}</div>
          </div>
          <Badge tone={isOverdue(m, today) ? "bad" : "warn"}>{formatDate(m.dueDate)}</Badge>
        </li>
      ))}
    </ul>
  );
}
