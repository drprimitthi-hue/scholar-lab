"use client";
import { useCards, useLeaves, usePlans, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { addDays, dateRange, dayOfWeek, todayInTz } from "@/lib/domain/dates";
import type { ProjectDoc } from "@/lib/types";
import { Card, Empty, Spinner } from "../ui";
import { BurnUp, Funnel, Heatmap } from "../charts";

const dayOf = (ms: number | null, tz: string) => (ms ? todayInTz(tz, new Date(ms)) : "");

export function Progress({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const plans = usePlans(project.id);
  const cards = useCards({ projectId: project.id });
  const scholars = useScholars();
  const leaves = useLeaves({});
  const tz = s.settings.timezone;
  const today = todayInTz(tz);
  if (plans.loading || cards.loading) return <Spinner />;
  const members = scholars.data.filter((x) => project.scholarUids.includes(x.uid) && (s.role !== "scholar" || x.uid === s.user?.uid));
  if (!members.length || !plans.data.length) return <Card><Empty>Progress appears once reading plans exist.</Empty></Card>;

  const planned = plans.data.flatMap((p) => p.batches.flatMap((b) => b.itemIds.map(() => b.date)));
  const start = [...planned].sort()[0] ?? today;
  const end = [...planned].sort().at(-1)! > today ? [...planned].sort().at(-1)! : today;
  const dates = dateRange(start, end, 400);
  const cum = (days: string[]) => dates.map((d) => days.filter((x) => x && x <= d).length);
  const submittedDays = cards.data.filter((c) => c.submittedAt).map((c) => dayOf(c.submittedAt, tz));
  const acceptedDays = cards.data.filter((c) => c.status === "accepted").map((c) => dayOf(c.reviewedAt, tz));
  const upToToday = (v: number[]) => v.map((x, i) => (dates[i]! <= today ? x : null));

  const totalPlanned = planned.length;
  const opened = cards.data.length;
  const submitted = cards.data.filter((c) => c.submittedAt).length;
  const accepted = acceptedDays.length;
  const releasedToDate = planned.filter((d) => d <= today).length;

  const days = dateRange(addDays(today, -41), today);
  const subByKey = new Map<string, number>();
  cards.data.forEach((c) => { if (c.submittedAt) { const k = `${c.uid}|${dayOf(c.submittedAt, tz)}`; subByKey.set(k, (subByKey.get(k) ?? 0) + 1); } });
  const isOff = (uid: string, d: string) =>
    s.settings.weekendDays.includes(dayOfWeek(d)) || s.settings.holidays.includes(d) || leaves.data.some((l) => l.uid === uid && l.status === "approved" && l.from <= d && l.to >= d);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Reading burn-up" className="lg:col-span-2">
        <BurnUp dates={dates} series={[
          { key: "planned", label: "Planned (cumulative)", values: cum(planned) },
          { key: "submitted", label: "Cards submitted", values: upToToday(cum(submittedDays)) },
          { key: "accepted", label: "Cards accepted", values: upToToday(cum(acceptedDays)) },
        ]} />
      </Card>
      <Card title="Where papers stand">
        <Funnel steps={[
          { label: "Planned", value: totalPlanned },
          { label: "Due by today", value: releasedToDate },
          { label: "Opened", value: opened },
          { label: "Card submitted", value: submitted },
          { label: "Accepted", value: accepted },
        ]} />
      </Card>
      <Card title="Daily activity · cards submitted, last 6 weeks" className="lg:col-span-3">
        <Heatmap rows={members.map((m) => ({ id: m.uid, label: m.name }))} days={days} value={(u, d) => subByKey.get(`${u}|${d}`) ?? 0} off={isOff} />
      </Card>
    </div>
  );
}
