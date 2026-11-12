"use client";
import { useState } from "react";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useLeaves, usePresenceOf, useScholarSub } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { addDays, dateRange, dayOfWeek, formatDate, formatTime, todayInTz } from "@/lib/domain/dates";
import type { DocumentMeta, LeaveDoc, ScholarDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Spinner, useAction } from "../ui";

export const leaveTone = (st: LeaveDoc["status"]) => (st === "approved" ? "ok" : st === "pending" ? "warn" : st === "rejected" ? "bad" : "neutral");

export function PresenceHistory({ scholar }: { scholar: ScholarDoc }) {
  const s = useSession();
  const today = todayInTz(s.settings.timezone);
  const from = addDays(today, -59);
  const { data, loading, error } = usePresenceOf(scholar.uid, from);
  const leaves = useLeaves({ uid: scholar.uid });
  if (loading) return <Spinner />;
  const byDate = new Map(data.map((p) => [p.date, p]));
  const onLeave = (d: string) => leaves.data.some((l) => l.status === "approved" && l.from <= d && l.to >= d);
  const days = dateRange(from, today).reverse();
  const present = data.filter((p) => p.status === "present").length;
  return (
    <Card title={`Presence · last 60 days`} action={<Badge tone="accent">{present} days present</Badge>}>
      <ErrorText>{error}</ErrorText>
      <div className="mb-5 flex flex-wrap gap-1" aria-label="Presence heatmap">
        {[...days].reverse().map((d) => {
          const p = byDate.get(d);
          const off = s.settings.weekendDays.includes(dayOfWeek(d)) || s.settings.holidays.includes(d);
          const c = p?.status === "present" ? "bg-ok" : onLeave(d) || p?.status === "on_leave" ? "bg-sky-300" : off || p?.status === "holiday" ? "bg-gray-100" : "bg-red-200";
          return <span key={d} title={`${formatDate(d)}`} className={`h-4 w-4 rounded-sm ${c}`} />;
        })}
      </div>
      <div className="mb-3 flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-ok" />Present</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-300" />Leave</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-200" />Absent</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-gray-100" />Weekend/holiday</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {days.slice(0, 21).map((d) => {
            const p = byDate.get(d);
            return (
              <tr key={d} className="border-b border-line/60 last:border-0">
                <td className="py-1.5 pr-3">{formatDate(d)}</td>
                <td className="py-1.5 pr-3">{p ? <Badge tone={p.status === "present" ? "ok" : "neutral"}>{p.status.replace("_", " ")}</Badge> : onLeave(d) ? <Badge tone="accent">on leave</Badge> : <span className="text-muted">—</span>}</td>
                <td className="py-1.5 pr-3 text-muted">{formatTime(p?.checkIn, s.settings.timezone)} – {formatTime(p?.checkOut, s.settings.timezone)}</td>
                <td className="py-1.5 text-xs text-muted">{p?.corrected ? `Corrected: ${p.corrected.reason}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function LeaveHistory({ scholar }: { scholar: ScholarDoc }) {
  const s = useSession();
  const { data, loading, error } = useLeaves({ uid: scholar.uid });
  if (loading) return <Spinner />;
  const list = [...data].sort((a, b) => b.from.localeCompare(a.from));
  const year = todayInTz(s.settings.timezone).slice(0, 4);
  return (
    <Card title="Leave">
      <ErrorText>{error}</ErrorText>
      <div className="mb-4 flex flex-wrap gap-2">
        {s.settings.leaveTypes.map((t) => {
          const used = data.filter((l) => l.type === t.id && l.status === "approved" && l.from.startsWith(year)).reduce((x, l) => x + l.days, 0);
          return <Badge key={t.id}>{t.name}: {used}{t.yearlyQuota ? ` / ${t.yearlyQuota}` : ""} days ({year})</Badge>;
        })}
      </div>
      {!list.length ? <Empty>No leave records.</Empty> : (
        <ul className="divide-y divide-line/60 text-sm">
          {list.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{s.settings.leaveTypes.find((t) => t.id === l.type)?.name ?? l.type} · {formatDate(l.from)} – {formatDate(l.to)} · {l.days} day(s)</span>
              <Badge tone={leaveTone(l.status)}>{l.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Documents({ scholar }: { scholar: ScholarDoc }) {
  const s = useSession();
  const { data, loading, error } = useScholarSub<DocumentMeta>(scholar.uid, "documents");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Admission");
  const [file, setFile] = useState<File | null>(null);
  const a = useAction();
  const canUpload = !scholar.deletion && (s.role === "supervisor" || (s.role === "scholar" && s.user?.uid === scholar.uid));

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return a.setError("Choose a file");
    const ok = await a.run(async () => {
      const path = await uploadFile(scholar.uid, file);
      await api(`/api/scholars/${scholar.uid}/documents`, "POST", { title, category, path });
    });
    if (ok) { setOpen(false); setTitle(""); setFile(null); }
  }

  if (loading) return <Spinner />;
  const list = [...data].sort((x, y) => y.uploadedAt - x.uploadedAt);
  return (
    <Card title="Documents" action={canUpload && <Button variant="ghost" onClick={() => setOpen(true)}>Upload</Button>}>
      <ErrorText>{error}</ErrorText>
      {!list.length ? <Empty>No documents yet.</Empty> : (
        <ul className="divide-y divide-line/60 text-sm">
          {list.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div><button className="font-medium text-accent hover:underline" onClick={() => openFile(d.path).catch((e: Error) => alert(e.message))}>{d.title}</button>
                <div className="text-xs text-muted">{d.category} · {new Date(d.uploadedAt).toLocaleDateString("en-GB")} · {(d.size / 1024).toFixed(0)} KB</div></div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload document">
        <form onSubmit={upload} className="space-y-3">
          <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Category"><Input required list="doc-cats" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
          <datalist id="doc-cats">{["Admission", "Coursework", "Proposal", "Progress report", "Certificate", "NOC", "Thesis", "Other"].map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="File (PDF or image, max 10 MB)"><Input type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <ErrorText>{a.error}</ErrorText>
          <Button type="submit" disabled={a.busy}>{a.busy ? "Uploading…" : "Upload"}</Button>
        </form>
      </Modal>
    </Card>
  );
}
