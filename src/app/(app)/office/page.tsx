"use client";
import { useState } from "react";
import Link from "next/link";
import { useDiary, useDuties, useMeetings, useSemesters } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { dutyState, minutesBetween } from "@/lib/domain/office";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import type { DiaryEntry } from "@/lib/types";
import { Badge, Button, Card, Empty, PageHeader } from "@/components/ui";
import { EditEntry, EntryRow, QuickDiary } from "@/components/office/Diary";
import { useRouter } from "next/navigation";

export default function OfficeToday() {
  const ss = useSession();
  const today = todayInTz(ss.settings.timezone);
  const diary = useDiary(today, today);
  const duties = useDuties();
  const meetings = useMeetings();
  const [edit, setEdit] = useState<DiaryEntry | null>(null);
  const router = useRouter();
  const entries = [...diary.data].sort((a, b) => a.start.localeCompare(b.start));
  const teachingMin = entries.filter((e) => ["lecture", "lab", "tutorial"].includes(e.type)).reduce((t, e) => t + minutesBetween(e.start, e.end), 0);
  const due = duties.data.map((d) => ({ d, ...dutyState(d, today) })).filter((x) => ["overdue", "today", "soon"].includes(x.state)).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const upcoming = meetings.data.filter((m) => m.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 4);
  return (
    <>
      <PageHeader title="My Office" subtitle={formatDate(today)} />
      <Card title="Diary — add as you go" className="mb-5"><QuickDiary /></Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={`Today · ${entries.length} entr${entries.length === 1 ? "y" : "ies"}${teachingMin ? ` · ${Math.round(teachingMin / 6) / 10} h teaching` : ""}`} className="lg:col-span-2" action={<Link href="/office/diary" className="text-sm text-accent">Full diary</Link>}>
          {!entries.length ? <Empty>Nothing recorded yet today.</Empty> : <ul className="divide-y divide-line/60">{entries.map((e) => <EntryRow key={e.id} e={e} onEdit={() => setEdit(e)} />)}</ul>}
        </Card>
        <div className="space-y-5">
          <Card title="Duties due" action={<Link href="/office/duties" className="text-sm text-accent">All</Link>}>
            {!due.length ? <p className="text-sm text-muted">Nothing due soon.</p> : (
              <ul className="space-y-2 text-sm">{due.map(({ d, state, daysLeft }) => (
                <li key={d.id} className="flex items-start justify-between gap-2"><Link href={`/office/duties?id=${d.id}`} className="hover:text-accent">{d.title}</Link>
                  <Badge tone={state === "overdue" ? "bad" : state === "today" ? "warn" : "accent"}>{state === "overdue" ? `${-daysLeft!} d overdue` : state === "today" ? "today" : `${daysLeft} d`}</Badge></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Upcoming meetings" action={<Link href="/office/meetings" className="text-sm text-accent">All</Link>}>
            {!upcoming.length ? <p className="text-sm text-muted">None scheduled.</p> : <ul className="space-y-1 text-sm">{upcoming.map((m) => <li key={m.id}><Link href={`/office/meetings/${m.id}`} className="hover:text-accent">{formatDate(m.date)}{m.time && ` ${m.time}`} · {m.title}</Link></li>)}</ul>}
            <Button variant="soft" className="mt-3" onClick={() => router.push("/office/meetings?new=1")}>Record a meeting</Button>
          </Card>
        </div>
      </div>
      <EditEntry e={edit} onClose={() => setEdit(null)} />
    </>
  );
}
