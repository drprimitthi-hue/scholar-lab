"use client";
import { useMemo, useState } from "react";
import { useSession } from "@/lib/client/session";
import { useAllMilestones, useScholars, useUsers } from "@/lib/client/data";
import { api } from "@/lib/client/api";
import { todayInTz } from "@/lib/domain/dates";
import { Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, useAction } from "@/components/ui";
import { ScholarTable } from "@/components/scholar-bits";
import { TempPassword } from "@/components/TempPassword";

function AddScholar({ onClose }: { onClose: () => void }) {
  const s = useSession();
  const users = useUsers();
  const mentors = users.data.filter((u) => u.role === "mentor" && u.status === "active");
  const [f, setF] = useState({ name: "", email: "", programmeId: s.settings.programmes[0]?.id ?? "", joiningDate: todayInTz(s.settings.timezone), enrolmentNo: "", mentorUid: "" });
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const a = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      const r = await api<{ uid: string; tempPassword: string }>("/api/admin/users", "POST", {
        role: "scholar", name: f.name, email: f.email, programmeId: f.programmeId, joiningDate: f.joiningDate,
        enrolmentNo: f.enrolmentNo || undefined, mentorUids: f.mentorUid ? [f.mentorUid] : [],
      });
      setCreated({ email: f.email.toLowerCase(), password: r.tempPassword });
    });
  }

  if (created) return <div className="space-y-4"><TempPassword email={created.email} password={created.password} /><Button onClick={onClose}>Done</Button></div>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Programme">
          <Select value={f.programmeId} onChange={(e) => setF({ ...f, programmeId: e.target.value })}>
            {s.settings.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Joining date"><Input type="date" required value={f.joiningDate} onChange={(e) => setF({ ...f, joiningDate: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Enrolment no. (optional)"><Input value={f.enrolmentNo} onChange={(e) => setF({ ...f, enrolmentNo: e.target.value })} /></Field>
        <Field label="Mentor (optional)">
          <Select value={f.mentorUid} onChange={(e) => setF({ ...f, mentorUid: e.target.value })}>
            <option value="">None</option>
            {mentors.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted">Degree milestones are created automatically from the programme template and the joining date.</p>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Creating…" : "Create scholar account"}</Button>
    </form>
  );
}

export default function ScholarsPage() {
  const s = useSession();
  const scholars = useScholars();
  const ms = useAllMilestones();
  const [q, setQ] = useState("");
  const [prog, setProg] = useState("");
  const [open, setOpen] = useState(false);
  const today = todayInTz(s.settings.timezone);

  const list = useMemo(
    () =>
      scholars.data.filter(
        (x) => (!prog || x.programmeId === prog) && (!q || `${x.name} ${x.email} ${x.enrolmentNo} ${x.researchTopic}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [scholars.data, q, prog],
  );

  return (
    <>
      <PageHeader title={s.role === "mentor" ? "My scholars" : "Scholars"} subtitle={`${list.length} shown`} action={s.role === "supervisor" && <Button onClick={() => setOpen(true)}>Add scholar</Button>} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search name, email, enrolment, topic…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={prog} onChange={(e) => setProg(e.target.value)}>
            <option value="">All programmes</option>
            {s.settings.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <ErrorText>{scholars.error}</ErrorText>
        {scholars.loading ? <Spinner /> : <ScholarTable scholars={list} milestones={ms.data} settings={s.settings} today={today} />}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add scholar">{open && <AddScholar onClose={() => setOpen(false)} />}</Modal>
    </>
  );
}
