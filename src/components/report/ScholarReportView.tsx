"use client";
import { useState } from "react";
import { useCards, useConceptNotes, useLeaves, useMilestones, useOutputs, usePresenceOf, useScholar, useScores, useSessions, useTasks } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { scholarReport } from "@/lib/domain/reports";
import { addMonths, formatDate, todayInTz } from "@/lib/domain/dates";
import { KIND_LABEL, stepOf } from "@/lib/domain/outputs";
import { Button, Card, ErrorText, Spinner, Textarea } from "@/components/ui";
import { PeriodPicker } from "./Period";

const MASTERY_LABEL: Record<string, string> = { heard: "Heard of", explained: "Explained", applied: "Applied", taught: "Taught" };

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">{label}</p><p className="text-xl font-semibold">{value}</p>{hint && <p className="text-[11px] text-muted">{hint}</p>}</div>;
}
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-6 border-b border-line pb-1 text-sm font-semibold uppercase tracking-wide text-accent">{children}</h2>;

/** Printable progress report for one scholar over a period. Uses only data the viewer can already see. */
export function ScholarReportView({ uid }: { uid: string }) {
  const ss = useSession();
  const today = todayInTz(ss.settings.timezone);
  const [from, setFrom] = useState(addMonths(today, -6));
  const [to, setTo] = useState(today);
  const [remarks, setRemarks] = useState("");
  const scholar = useScholar(uid);
  const milestones = useMilestones(uid);
  const presence = usePresenceOf(uid, from);
  const leaves = useLeaves({ uid });
  const cards = useCards({});
  const notes = useConceptNotes({ uid });
  const sessions = useSessions();
  const scores = useScores({ uid });
  const tasks = useTasks({ uid });
  const outputs = useOutputs();
  if (scholar.loading || milestones.loading) return <Spinner />;
  const s = scholar.data;
  if (!s) return <ErrorText>{scholar.error ?? "Scholar not found."}</ErrorText>;
  const r = scholarReport(uid, {
    milestones: milestones.data, presence: presence.data, leaves: leaves.data, cards: cards.data, notes: notes.data,
    sessions: sessions.data, scores: scores.data, tasks: tasks.data, outputs: outputs.data,
  }, { from, to, tz: ss.settings.timezone }, today);
  const programme = ss.settings.programmes.find((p) => p.id === s.programmeId)?.name ?? "";
  const chair = ss.role === "supervisor" || ss.role === "mentor";
  return (
    <>
      <Card className="mb-5 print:hidden">
        <PeriodPicker today={today} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        {chair && <div className="mt-3"><Textarea rows={3} placeholder="Remarks to print on the report (not saved)" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>}
        <Button className="mt-3" onClick={() => window.print()}>Print / save as PDF</Button>
      </Card>
      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 print:max-w-none print:border-0 print:p-0">
        <p className="text-xs uppercase tracking-wide text-muted">{ss.settings.labName}{ss.settings.institution && ` · ${ss.settings.institution}`}</p>
        <h1 className="mt-1 text-xl font-semibold">Progress report: {s.name}</h1>
        <p className="text-sm">{[programme, s.specialisation, s.enrolmentNo && `Enrolment ${s.enrolmentNo}`, s.joiningDate && `joined ${formatDate(s.joiningDate)}`, s.status].filter(Boolean).join(" · ")}</p>
        {s.researchTopic && <p className="text-sm text-muted">{s.researchTopic}</p>}
        <p className="mt-1 text-xs text-muted">Period {formatDate(from)} – {formatDate(to)} · generated {formatDate(today)}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Degree progress" value={`${r.degree.progress}%`} hint={`${r.degree.done}/${r.degree.total} milestones`} />
          <Kpi label="Presence" value={r.presence.rate === null ? "—" : `${r.presence.rate}%`} hint={`${r.presence.present} present · ${r.presence.leaveDays} leave days`} />
          <Kpi label="Reading cards accepted" value={r.reading.accepted} hint={`${r.reading.submitted} submitted${r.reading.acceptance !== null ? ` · ${r.reading.acceptance}% first-pass` : ""}`} />
          <Kpi label="Talks / avg score" value={`${r.seminars.talks.length} / ${r.seminars.score === null ? "—" : r.seminars.score.toFixed(1)}`} hint={r.seminars.attendance === null ? "no attendance recorded" : `seminar attendance ${r.seminars.attendance}%`} />
        </div>

        <H>Degree milestones</H>
        <ul className="mt-2 space-y-1 text-sm">
          {r.degree.completedInPeriod.map((m) => <li key={m.id}>✓ {m.title} <span className="text-muted">— completed {formatDate(m.completedOn!)}</span></li>)}
          {r.degree.overdue.map((m) => <li key={m.id} className="text-bad">! {m.title} <span>— overdue since {formatDate(m.dueDate)}</span></li>)}
          {r.degree.next && <li>→ Next: {r.degree.next.title} <span className="text-muted">— due {formatDate(r.degree.next.dueDate)}</span></li>}
          {!r.degree.completedInPeriod.length && !r.degree.overdue.length && !r.degree.next && <li className="text-muted">Nothing to report.</li>}
        </ul>

        <H>Literature</H>
        <p className="mt-2 text-sm">{r.reading.submitted} reading cards submitted on {r.reading.activeDays} day(s); {r.reading.accepted} accepted, {r.reading.revise} returned for revision; {r.reading.pending} awaiting review now.</p>

        <H>Concepts</H>
        <p className="mt-2 text-sm">{r.concepts.acceptedInPeriod} concept note(s) accepted in the period. Current mastery: {Object.entries(r.concepts.mastery).map(([k, v]) => `${MASTERY_LABEL[k]} ${v}`).join(" · ")}.</p>

        <H>Seminars</H>
        {!r.seminars.talks.length ? <p className="mt-2 text-sm text-muted">No talks in this period.</p> : <ul className="mt-2 space-y-1 text-sm">{r.seminars.talks.map((t) => <li key={t.id}>{formatDate(t.date)} — {t.speakers.find((x) => x.uid === uid)?.topic || t.title}</li>)}</ul>}
        <p className="mt-1 text-sm">Attended {r.seminars.attended} of {r.seminars.held} sessions with attendance recorded{r.seminars.ratings ? `; average talk score ${r.seminars.score!.toFixed(1)}/5 from ${r.seminars.ratings} rating(s)` : ""}.</p>

        <H>Outputs</H>
        {!r.outputs.list.length ? <p className="mt-2 text-sm text-muted">None.</p> : (
          <ul className="mt-2 space-y-1.5 text-sm">{r.outputs.list.map(({ o, moves }) => (
            <li key={o.id}><span className="font-medium">{o.title}</span> <span className="text-muted">({KIND_LABEL[o.kind]}, now: {stepOf(o.kind, o.status)?.label})</span>{moves.length > 0 && <span className="block text-xs text-muted">In period: {moves.map((m) => `${m.to} ${formatDate(m.at)}`).join("; ")}</span>}</li>
          ))}</ul>
        )}

        <H>Tasks and presence</H>
        <p className="mt-2 text-sm">Tasks: {r.tasks.created} new, {r.tasks.done} completed in the period; {r.tasks.open} open now{r.tasks.overdue ? `, ${r.tasks.overdue} overdue` : ""}.</p>
        <p className="text-sm">Presence: {r.presence.present} present, {r.presence.absent} absent, {r.presence.onLeave} on leave (of {r.presence.recorded} recorded days). Approved leave: {r.presence.leaveDays} day(s){r.presence.leaves.length ? ` (${r.presence.leaves.map((l) => l.type).join(", ")})` : ""}.</p>

        {remarks && <><H>Remarks</H><p className="mt-2 whitespace-pre-wrap text-sm">{remarks}</p></>}
        <div className="mt-12 grid grid-cols-2 gap-8 text-xs text-muted print:mt-16"><p className="border-t border-line pt-1">Scholar</p><p className="border-t border-line pt-1">Supervisor</p></div>
      </article>
    </>
  );
}
