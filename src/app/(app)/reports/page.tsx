"use client";
import { useState } from "react";
import Link from "next/link";
import { useAllMilestones, useCards, useConceptNotes, useLeaves, useOutputs, useScholars, useScores, useSessions, useTasks } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { labReport, scholarReport } from "@/lib/domain/reports";
import { addMonths, formatDate, todayInTz } from "@/lib/domain/dates";
import { Button, Card, PageHeader, Spinner } from "@/components/ui";
import { PeriodPicker } from "@/components/report/Period";

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-6 border-b border-line pb-1 text-sm font-semibold uppercase tracking-wide text-accent">{children}</h2>;
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <tr className="border-b border-line/60"><td className="py-1">{k}</td><td className="text-right font-medium">{v}</td></tr>;

/** Lab-wide report for a period (supervisor). */
export default function LabReportPage() {
  const ss = useSession();
  const today = todayInTz(ss.settings.timezone);
  const [from, setFrom] = useState(addMonths(today, -6));
  const [to, setTo] = useState(today);
  const scholars = useScholars();
  const milestones = useAllMilestones();
  const cards = useCards({});
  const notes = useConceptNotes({});
  const sessions = useSessions();
  const scores = useScores({});
  const tasks = useTasks({});
  const outputs = useOutputs();
  const leaves = useLeaves({});
  if (ss.role !== "supervisor") return <Card><p className="text-sm text-muted">The lab report is for the supervisor. Scholar progress reports are on each scholar’s record.</p></Card>;
  if (scholars.loading || milestones.loading) return <Spinner />;
  const p = { from, to, tz: ss.settings.timezone };
  const r = labReport({ scholars: scholars.data, milestones: milestones.data, cards: cards.data, sessions: sessions.data, outputs: outputs.data, leaves: leaves.data }, p, today);
  const prog = (id: string) => ss.settings.programmes.find((x) => x.id === id)?.name ?? id;
  const active = scholars.data.filter((s) => !s.deletion).sort((a, b) => a.name.localeCompare(b.name));
  const rows = active.map((s) => ({ s, r: scholarReport(s.uid, { milestones: milestones.data, presence: [], leaves: leaves.data, cards: cards.data, notes: notes.data, sessions: sessions.data, scores: scores.data, tasks: tasks.data, outputs: outputs.data }, p, today) }));
  const cite = (o: { authors: string; title: string; venue: string; year: string }) => `${o.authors ? `${o.authors}. ` : ""}${o.title}. ${o.venue}${o.year ? ` (${o.year})` : ""}`;
  return (
    <>
      <div className="print:hidden"><PageHeader title="Lab report" subtitle="Progress of the whole group over a period" /></div>
      <Card className="mb-5 print:hidden">
        <PeriodPicker today={today} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <Button className="mt-3" onClick={() => window.print()}>Print / save as PDF</Button>
      </Card>
      <article className="mx-auto max-w-4xl rounded-2xl border border-line bg-white p-8 print:max-w-none print:border-0 print:p-0">
        <h1 className="text-xl font-semibold">{ss.settings.labName}: progress report</h1>
        <p className="text-sm">{[ss.settings.supervisorName, ss.settings.department, ss.settings.institution].filter(Boolean).join(", ")}</p>
        <p className="text-xs text-muted">Period {formatDate(from)} – {formatDate(to)} · generated {formatDate(today)}</p>

        <div className="grid gap-6 md:grid-cols-2">
          <div><H>Group</H><table className="mt-2 w-full text-sm"><tbody>
            <Row k="Active scholars" v={r.scholars.total} />
            {Object.entries(r.scholars.byProgramme).map(([k, v]) => <Row key={k} k={`· ${prog(k)}`} v={v} />)}
            <Row k="Milestones completed in period" v={r.milestones.completed} />
            <Row k="Milestones overdue now" v={r.milestones.overdue} />
            <Row k="Milestones due in next 30 days" v={r.milestones.dueNext30} />
          </tbody></table></div>
          <div><H>Activity</H><table className="mt-2 w-full text-sm"><tbody>
            <Row k="Reading cards submitted / accepted" v={`${r.reading.submitted} / ${r.reading.accepted}`} />
            <Row k="Seminars held / talks given" v={`${r.seminars.held} / ${r.seminars.talks}`} />
            <Row k="Papers submitted / accepted / published" v={`${r.outputs.submitted.length} / ${r.outputs.accepted.length} / ${r.outputs.published.length}`} />
            <Row k="Patents filed or granted" v={r.outputs.patents.length} />
            <Row k="Papers under review now" v={r.outputs.underReview} />
            <Row k="Approved leave (days)" v={r.leaves.approvedDays} />
          </tbody></table></div>
        </div>

        {(r.outputs.published.length > 0 || r.outputs.accepted.length > 0 || r.outputs.patents.length > 0) && <>
          <H>Outputs in the period</H>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {r.outputs.published.map((o) => <li key={`p${o.id}`}>{cite(o)} <span className="text-muted">[published]</span></li>)}
            {r.outputs.accepted.map((o) => <li key={`a${o.id}`}>{cite(o)} <span className="text-muted">[accepted]</span></li>)}
            {r.outputs.patents.map(({ o, to: st }) => <li key={`t${o.id}${st}`}>{o.title} {o.identifier && `(${o.identifier})`} <span className="text-muted">[patent {st}]</span></li>)}
          </ol>
        </>}

        <H>Scholars</H>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Scholar</th><th>Programme</th><th className="text-right">Degree</th><th className="text-right">Overdue</th><th className="text-right">Cards ✓</th><th className="text-right">Concepts ✓</th><th className="text-right">Talks</th><th className="text-right">Seminar att.</th><th className="text-right">Open tasks</th></tr></thead>
          <tbody>{rows.map(({ s, r: x }) => (
            <tr key={s.uid} className="border-t border-line/60">
              <td className="py-1.5"><Link href={`/scholars/${s.uid}/report`} className="hover:text-accent">{s.name}</Link></td>
              <td>{prog(s.programmeId)}</td>
              <td className="text-right">{x.degree.progress}%</td>
              <td className={`text-right ${x.degree.overdue.length ? "text-bad" : ""}`}>{x.degree.overdue.length}</td>
              <td className="text-right">{x.reading.accepted}</td>
              <td className="text-right">{x.concepts.acceptedInPeriod}</td>
              <td className="text-right">{x.seminars.talks.length}</td>
              <td className="text-right">{x.seminars.attendance === null ? "—" : `${x.seminars.attendance}%`}</td>
              <td className="text-right">{x.tasks.open}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="mt-2 text-xs text-muted print:hidden">Open a scholar’s name for their full printable report.</p>
      </article>
    </>
  );
}
