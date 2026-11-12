"use client";
import Link from "next/link";
import { useSession } from "@/lib/client/session";
import { useAllMilestones, useCards, useConceptNotes, useOutputs, useLeaves, usePresenceOn, useScholars, useSessions } from "@/lib/client/data";
import { TaskList } from "@/components/scholar/Seminars";
import { useDuties } from "@/lib/client/office";
import { dutyState } from "@/lib/domain/office";
import type { SessionDoc } from "@/lib/types";
import { addDays, dateRange, dayOfWeek, todayInTz, formatDate } from "@/lib/domain/dates";
import { degreeProgress, isOverdue } from "@/lib/domain/milestones";
import { Badge, Card, ErrorText, PageHeader, Progress, Spinner } from "@/components/ui";
import { DueSoonList, ScholarTable, programmeName } from "@/components/scholar-bits";
import { CheckInCard } from "@/components/CheckIn";
import { Heatmap } from "@/components/charts";

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

function NextSessions({ sessions, today, me }: { sessions: SessionDoc[]; today: string; me?: string }) {
  const next = sessions.filter((x) => x.status === "scheduled" && x.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
  if (!next.length) return <p className="text-sm text-muted">Nothing scheduled.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {next.map((x) => {
        const speaking = me && x.speakerUids.includes(me);
        const slides = speaking && x.speakers.find((p) => p.uid === me)?.slidesPath;
        return (
          <li key={x.id}><Link href={`/seminars/${x.id}`} className="hover:underline">{formatDate(x.date)}{x.time && ` ${x.time}`} · {x.title}</Link>
            {speaking && <span className={`ml-2 text-xs ${slides ? "text-ok" : "text-warn"}`}>{slides ? "you speak · slides in" : "you speak · upload slides"}</span>}
            {!me && <span className="ml-2 text-xs text-muted">{x.speakers.map((p) => p.name).join(", ")}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export default function Dashboard() {
  const s = useSession();
  const today = todayInTz(s.settings.timezone);
  const scholars = useScholars();
  const ms = useAllMilestones();
  const leaves = useLeaves({});
  const presence = usePresenceOn(today);
  const cards = useCards({});
  const sessions = useSessions();
  const notes = useConceptNotes({ status: "submitted" });
  const outputs = useOutputs();
  const duties = useDuties();

  if (scholars.loading || ms.loading) return <Spinner />;
  const err = scholars.error || ms.error || leaves.error || presence.error;

  if (s.role === "scholar") {
    const me = scholars.data[0];
    const mine = ms.data.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const pct = degreeProgress(mine);
    return (
      <>
        <PageHeader title={`Welcome, ${s.profile?.name?.split(" ")[0] ?? ""}`} subtitle={me ? programmeName(s.settings, me.programmeId) : undefined} />
        <ErrorText>{err}</ErrorText>
        <div className="grid gap-5 md:grid-cols-2">
          <CheckInCard />
          <Card title="Reading" action={<Link href="/reading" className="text-sm text-accent">Open today&apos;s reading</Link>}>
            <p className="text-sm">Cards accepted: <b>{cards.data.filter((c) => c.status === "accepted").length}</b> · waiting for review: <b>{cards.data.filter((c) => c.status === "submitted").length}</b> · to revise: <b className={cards.data.some((c) => c.status === "revise") ? "text-warn" : ""}>{cards.data.filter((c) => c.status === "revise").length}</b></p>
          </Card>
          <Card title="Degree progress" action={<Link href="/me?tab=degree" className="text-sm text-accent">Details</Link>}>
            <div className="flex items-center gap-3"><Progress value={pct} /><span className="text-sm font-medium">{pct}%</span></div>
            <ul className="mt-4 space-y-2 text-sm">
              {mine.filter((m) => m.status !== "approved" && m.status !== "waived").slice(0, 4).map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span>{m.title}</span>
                  <span className={isOverdue(m, today) ? "text-bad" : "text-muted"}>{formatDate(m.dueDate)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Seminars" action={<Link href="/seminars" className="text-sm text-accent">All</Link>}><NextSessions sessions={sessions.data} today={today} me={s.user?.uid} /></Card>
          <Card title="My tasks" className="md:col-span-2"><TaskList compact /></Card>
        </div>
      </>
    );
  }

  const active = scholars.data.filter((x) => !x.deletion);
  const overdue = ms.data.filter((m) => isOverdue(m, today)).length;
  const pending = leaves.data.filter((l) => l.status === "pending").length;
  const present = presence.data.filter((p) => p.status === "present").length;
  const toReview = cards.data.filter((c) => c.status === "submitted").length;
  const days = dateRange(addDays(today, -41), today);
  const perDay = new Map<string, number>();
  cards.data.forEach((c) => { if (c.submittedAt) { const k = `${c.uid}|${todayInTz(s.settings.timezone, new Date(c.submittedAt))}`; perDay.set(k, (perDay.get(k) ?? 0) + 1); } });
  const off = (uid: string, d: string) => s.settings.weekendDays.includes(dayOfWeek(d)) || s.settings.holidays.includes(d) || leaves.data.some((l) => l.uid === uid && l.status === "approved" && l.from <= d && l.to >= d);
  return (
    <>
      <PageHeader title="Dashboard" subtitle={formatDate(today)} />
      <ErrorText>{err}</ErrorText>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Scholars" value={active.length} href="/scholars" />
        <Stat label="Present today" value={`${present}/${active.length}`} href="/presence" />
        <Stat label="Leave requests" value={pending} href="/leave" />
        <Stat label="To review (cards · notes)" value={`${toReview} · ${notes.data.length}`} href="/review" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Scholars" className="lg:col-span-2"><ScholarTable scholars={active} milestones={ms.data} settings={s.settings} today={today} /></Card>
        <Card title={`Due & overdue milestones (${overdue} overdue)`}><DueSoonList milestones={ms.data} scholars={active} today={today} /></Card>
        <Card title="My duties due" action={<Link href="/office/duties" className="text-sm text-accent">My Office</Link>}>
          {(() => {
            const due = duties.data.map((d) => ({ d, ...dutyState(d, today) })).filter((x) => ["overdue", "today", "soon"].includes(x.state)).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
            return !due.length ? <p className="text-sm text-muted">Nothing due soon.</p> : (
              <ul className="space-y-1.5 text-sm">{due.slice(0, 6).map(({ d, state, daysLeft }) => (
                <li key={d.id} className="flex justify-between gap-2"><Link href={`/office/duties?id=${d.id}`} className="hover:text-accent">{d.title}</Link>
                  <Badge tone={state === "overdue" ? "bad" : state === "today" ? "warn" : "accent"}>{state === "overdue" ? `${-daysLeft!} d late` : state === "today" ? "today" : `${daysLeft} d`}</Badge></li>
              ))}</ul>
            );
          })()}
        </Card>
        <Card title="Outputs" action={<Link href="/outputs" className="text-sm text-accent">Register</Link>}>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between"><span>Under review at journals/conferences</span><b>{outputs.data.filter((o) => !o.archived && o.kind === "publication" && ["submitted", "under_review", "revision"].includes(o.status)).length}</b></li>
            <li className="flex justify-between"><span>Waiting for your review</span><Link href="/review?tab=outputs" className="font-bold text-accent">{outputs.data.filter((o) => !o.archived && ["internal_review", "review"].includes(o.status)).length}</Link></li>
            <li className="flex justify-between"><span>Published this year</span><b>{outputs.data.filter((o) => !o.archived && o.kind === "publication" && o.status === "published" && o.year === today.slice(0, 4)).length}</b></li>
            <li className="flex justify-between"><span>Patents filed or later</span><b>{outputs.data.filter((o) => !o.archived && o.kind === "patent" && ["filed", "published", "examination", "granted"].includes(o.status)).length}</b></li>
          </ul>
        </Card>
        <Card title="Upcoming seminars" action={<Link href="/seminars" className="text-sm text-accent">All</Link>}><NextSessions sessions={sessions.data} today={today} /></Card>
        <Card title="Open scholar tasks" className="lg:col-span-3"><TaskList compact /></Card>
        <Card title="Reading activity · cards submitted per day, last 6 weeks" className="lg:col-span-3">
          <Heatmap rows={[...active].sort((a, b) => a.name.localeCompare(b.name)).map((x) => ({ id: x.uid, label: x.name }))} days={days} value={(u, d) => perDay.get(`${u}|${d}`) ?? 0} off={off} />
        </Card>
      </div>
    </>
  );
}
