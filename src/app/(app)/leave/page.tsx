"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useLeaves, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatDate, todayInTz, workingDays } from "@/lib/domain/dates";
import type { LeaveDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Notice, PageHeader, Select, Spinner, Tabs, Textarea, useAction } from "@/components/ui";
import { LeaveHistory, leaveTone } from "@/components/scholar/Records";

function Apply() {
  const s = useSession();
  const today = todayInTz(s.settings.timezone);
  const [f, setF] = useState({ type: s.settings.leaveTypes[0]?.id ?? "", from: today, to: today, reason: "" });
  const [file, setFile] = useState<File | null>(null);
  const a = useAction();
  const days = f.from && f.to && f.from <= f.to ? workingDays(f.from, f.to, s.settings.weekendDays, s.settings.holidays) : 0;
  return (
    <Card title="Apply for leave">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const ok = await a.run(async () => {
          const documentPath = file ? await uploadFile(s.user!.uid, file) : undefined;
          await api("/api/leaves", "POST", { ...f, documentPath });
        }, "Leave request sent");
        if (ok) { setF({ ...f, reason: "" }); setFile(null); }
      }}>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{s.settings.leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" required value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-muted">{days} working day(s)</p>
        <Field label="Reason"><Textarea required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <Field label="Supporting document (optional)"><Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
        <Button type="submit" disabled={a.busy || days === 0}>Submit request</Button>
      </form>
    </Card>
  );
}

function LeaveRow({ l, canDecide, canCancel }: { l: LeaveDoc; canDecide: boolean; canCancel: boolean }) {
  const s = useSession();
  const [remark, setRemark] = useState("");
  const a = useAction();
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm">
          <p className="font-medium">{l.scholarName} · {s.settings.leaveTypes.find((t) => t.id === l.type)?.name ?? l.type}</p>
          <p className="text-muted">{formatDate(l.from)} – {formatDate(l.to)} · {l.days} working day(s)</p>
          <p className="mt-1">{l.reason}</p>
          {l.documentPath && <button className="mt-1 text-xs text-accent hover:underline" onClick={() => openFile(l.documentPath!).catch((e: Error) => alert(e.message))}>📎 Supporting document</button>}
          {l.decisionRemark && <p className="mt-1 text-xs text-muted">Remark: {l.decisionRemark}</p>}
        </div>
        <Badge tone={leaveTone(l.status)}>{l.status}</Badge>
      </div>
      {(canDecide && l.status === "pending") || canCancel ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canDecide && l.status === "pending" && (
            <>
              <Input className="max-w-xs" placeholder="Remark (required to reject)" value={remark} onChange={(e) => setRemark(e.target.value)} />
              <Button variant="soft" disabled={a.busy} onClick={() => a.run(() => api(`/api/leaves/${l.id}`, "PATCH", { action: "approve", remark }))}>Approve</Button>
              <Button variant="ghost" disabled={a.busy} onClick={() => a.run(() => api(`/api/leaves/${l.id}`, "PATCH", { action: "reject", remark }))}>Reject</Button>
            </>
          )}
          {canCancel && <Button variant="ghost" disabled={a.busy} onClick={() => confirm("Cancel this leave?") && a.run(() => api(`/api/leaves/${l.id}`, "PATCH", { action: "cancel" }))}>Cancel leave</Button>}
        </div>
      ) : null}
      <ErrorText>{a.error}</ErrorText>
    </li>
  );
}

export default function LeavePage() {
  const s = useSession();
  const scholars = useScholars();
  const leaves = useLeaves({});
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "pending";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  if (leaves.loading || scholars.loading) return <Spinner />;

  if (s.role === "scholar") {
    const me = scholars.data[0];
    const mine = leaves.data.filter((l) => l.status === "pending");
    return (
      <>
        <PageHeader title="Leave" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Apply />
          <div className="space-y-5">
            {mine.length > 0 && <Card title="Pending requests"><ul className="divide-y divide-line/60">{mine.map((l) => <LeaveRow key={l.id} l={l} canDecide={false} canCancel />)}</ul></Card>}
            {me && <LeaveHistory scholar={me} />}
          </div>
        </div>
      </>
    );
  }

  const canDecide = s.role === "supervisor" || s.settings.mentorCanApproveLeave;
  const list = leaves.data.filter((l) => (tab === "pending" ? l.status === "pending" : true)).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <>
      <PageHeader title="Leave" />
      <Tabs tabs={[{ id: "pending", label: `Pending (${leaves.data.filter((l) => l.status === "pending").length})` }, { id: "all", label: "All" }]} value={tab} onChange={setTab} />
      <Card>
        <ErrorText>{leaves.error}</ErrorText>
        {!list.length ? <Empty>No leave requests.</Empty> : (
          <ul className="divide-y divide-line/60">
            {list.map((l) => <LeaveRow key={l.id} l={l} canDecide={canDecide} canCancel={s.role === "supervisor" && (l.status === "pending" || l.status === "approved")} />)}
          </ul>
        )}
      </Card>
    </>
  );
}
