"use client";
import Link from "next/link";
import { useConceptNotes, useScholars, useScores, useSessions, useTasks } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { api } from "@/lib/client/api";
import { MASTERY, averageScores, rubricMean } from "@/lib/domain/concepts";
import { formatDate } from "@/lib/domain/dates";
import type { ScholarDoc, ScoreDoc } from "@/lib/types";
import { Badge, Card, Empty, Stat } from "@/components/ui";
import { LineChart } from "@/components/charts";

const MASTERY_LABEL: Record<string, string> = { heard: "Heard of", explained: "Explained", applied: "Applied", taught: "Taught" };

export function TaskList({ uid, compact }: { uid?: string; compact?: boolean }) {
  const s = useSession();
  const tasks = useTasks({ uid });
  const scholars = useScholars();
  const names = new Map(scholars.data.map((x) => [x.uid, x.name]));
  const showOwner = !uid && s.role !== "scholar";
  const list = tasks.data.filter((t) => !uid || t.uid === uid).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9").localeCompare(b.due || "9"));
  const shown = compact ? list.filter((t) => !t.done).slice(0, 6) : list;
  const today = new Date().toISOString().slice(0, 10);
  if (!shown.length) return <Empty>{compact ? "No open tasks." : "No tasks yet."}</Empty>;
  return (
    <ul className="divide-y divide-line/60 text-sm">
      {shown.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-2 py-2">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={t.done} disabled={s.role === "alumni"}
              onChange={(e) => api(`/api/tasks/${t.id}`, "PATCH", { done: e.target.checked }).catch((err: Error) => alert(err.message))} />
            <span className={t.done ? "text-muted line-through" : ""}>{t.title}
              <span className="block text-xs text-muted">{showOwner && `${names.get(t.uid) ?? ""} · `}{t.source.type === "session" ? <Link className="underline" href={`/seminars/${t.source.id}`}>{t.source.title}</Link> : t.source.title}</span>
            </span>
          </label>
          {t.due && <Badge tone={!t.done && t.due < today ? "bad" : "neutral"}>{formatDate(t.due)}</Badge>}
        </li>
      ))}
    </ul>
  );
}

export function SeminarsTab({ scholar }: { scholar: ScholarDoc }) {
  const sessions = useSessions();
  const scores = useScores({ uid: scholar.uid });
  const notes = useConceptNotes({ uid: scholar.uid });
  const mine = sessions.data.filter((x) => x.speakerUids.includes(scholar.uid)).sort((a, b) => b.date.localeCompare(a.date));
  const held = sessions.data.filter((x) => x.status === "completed");
  const recorded = held.filter((x) => x.attendance[scholar.uid]);
  const present = recorded.filter((x) => x.attendance[scholar.uid] === "present").length;
  const myScores = scores.data.filter((x) => x.uid === scholar.uid);
  const bySession = new Map<string, ScoreDoc[]>();
  for (const sc of myScores) bySession.set(sc.sessionId, [...(bySession.get(sc.sessionId) ?? []), sc]);
  const trend = [...bySession.values()].map((list) => ({ x: list[0]!.sessionDate, y: averageScores(list).overall, title: list[0]!.sessionTitle })).sort((a, b) => a.x.localeCompare(b.x));
  const myNotes = notes.data.filter((n) => n.uid === scholar.uid);
  const counts = MASTERY.map((m) => ({ m, n: myNotes.filter((x) => x.mastery === m && (m === "heard" || x.status === "accepted")).length }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Talks given" value={mine.filter((x) => x.status === "completed").length} />
        <Stat label="Attendance" value={recorded.length ? `${Math.round((present / recorded.length) * 100)}%` : "—"} hint={recorded.length ? `${present} of ${recorded.length} recorded` : "no records yet"} />
        <Stat label="Average talk score" value={myScores.length ? `${(myScores.reduce((t, x) => t + rubricMean(x.scores), 0) / myScores.length).toFixed(1)}/5` : "—"} />
        <Stat label="Concepts explained+" value={myNotes.filter((x) => x.status === "accepted").length} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Talk score trend" className="lg:col-span-2"><LineChart points={trend} min={1} max={5} label="Average score" /></Card>
        <Card title="Concept mastery">
          <ul className="space-y-2 text-sm">{counts.map(({ m, n }) => <li key={m} className="flex justify-between"><span>{MASTERY_LABEL[m]}</span><span className="font-medium">{n}</span></li>)}</ul>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Talks">
          {!mine.length ? <Empty>No talks scheduled yet.</Empty> : (
            <ul className="divide-y divide-line/60 text-sm">{mine.map((x) => {
              const sp = x.speakers.find((p) => p.uid === scholar.uid);
              const list = bySession.get(x.id);
              return <li key={x.id} className="flex items-center justify-between gap-2 py-2"><Link className="hover:underline" href={`/seminars/${x.id}`}>{formatDate(x.date)} · {sp?.topic || x.title}</Link>
                <span className="flex gap-1">{!sp?.slidesPath && x.status === "scheduled" && <Badge tone="warn">no slides</Badge>}{list ? <Badge tone="accent">{averageScores(list).overall.toFixed(1)}</Badge> : <Badge tone={x.status === "completed" ? "ok" : "neutral"}>{x.status}</Badge>}</span></li>;
            })}</ul>
          )}
        </Card>
        <Card title="Tasks"><TaskList uid={scholar.uid} /></Card>
      </div>
    </div>
  );
}
