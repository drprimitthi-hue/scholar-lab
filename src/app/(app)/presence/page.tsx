"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useLeaves, usePresenceOn, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { dayOfWeek, formatDate, formatTime, todayInTz } from "@/lib/domain/dates";
import type { ScholarDoc } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, useAction } from "@/components/ui";
import { CheckInCard } from "@/components/CheckIn";
import { PresenceHistory } from "@/components/scholar/Records";

function Correct({ scholar, date, onClose }: { scholar: ScholarDoc; date: string; onClose: () => void }) {
  const [f, setF] = useState({ status: "present", checkIn: "", checkOut: "", reason: "" });
  const a = useAction();
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api("/api/presence", "PATCH", { uid: scholar.uid, date, ...f }))) onClose(); }}>
      <p className="text-sm">{scholar.name} · {formatDate(date)}</p>
      <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="on_leave">On leave</option><option value="holiday">Holiday</option></Select></Field>
      {f.status === "present" && <div className="grid grid-cols-2 gap-3"><Field label="Check-in"><Input type="time" value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} /></Field><Field label="Check-out"><Input type="time" value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} /></Field></div>}
      <Field label="Reason (recorded in the audit log)"><Input required minLength={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>Save correction</Button>
    </form>
  );
}

export default function PresencePage() {
  const s = useSession();
  const today = todayInTz(s.settings.timezone);
  const [date, setDate] = useState(today);
  const scholars = useScholars();
  const presence = usePresenceOn(date);
  const leaves = useLeaves({});
  const [fix, setFix] = useState<ScholarDoc | null>(null);

  if (s.role === "scholar") {
    const me = scholars.data[0];
    return (
      <>
        <PageHeader title="Presence" />
        <div className="space-y-5"><CheckInCard />{me && <PresenceHistory scholar={me} />}</div>
      </>
    );
  }
  if (scholars.loading) return <Spinner />;
  const canFix = s.role === "supervisor" || s.settings.mentorCanCorrectPresence;
  const off = s.settings.weekendDays.includes(dayOfWeek(date)) || s.settings.holidays.includes(date);
  const list = scholars.data.filter((x) => !x.deletion).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Presence" subtitle={`${formatDate(date)}${off ? " · weekend/holiday" : ""}`} action={<Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />} />
      <Card>
        <ErrorText>{scholars.error || presence.error}</ErrorText>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2">Scholar</th><th>Status</th><th>In – Out</th><th>Campus</th><th></th></tr></thead>
          <tbody>
            {list.map((sc) => {
              const p = presence.data.find((x) => x.uid === sc.uid);
              const leave = leaves.data.find((l) => l.uid === sc.uid && l.status === "approved" && l.from <= date && l.to >= date);
              return (
                <tr key={sc.uid} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 font-medium">{sc.name}</td>
                  <td>{p ? <Badge tone={p.status === "present" ? "ok" : "neutral"}>{p.status.replace("_", " ")}</Badge> : leave ? <Badge tone="accent">on leave</Badge> : <Badge tone={off ? "neutral" : "bad"}>{off ? "off" : "not checked in"}</Badge>}{p?.corrected && <span className="ml-1 text-xs text-muted">corrected</span>}</td>
                  <td className="text-muted">{formatTime(p?.checkIn, s.settings.timezone)} – {formatTime(p?.checkOut, s.settings.timezone)}</td>
                  <td className="text-muted">{p?.insideCampus === true ? "Yes" : p?.insideCampus === false ? "No" : "—"}</td>
                  <td className="text-right">{canFix && <Button variant="ghost" className="px-2 py-1" onClick={() => setFix(sc)}>Correct</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Modal open={fix !== null} onClose={() => setFix(null)} title="Correct presence">{fix && <Correct scholar={fix} date={date} onClose={() => setFix(null)} />}</Modal>
    </>
  );
}
