"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useDuties, useMeetings } from "@/lib/client/office";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, ErrorText, Modal, PageHeader, Spinner } from "@/components/ui";
import { DutyForm, MeetingForm } from "@/components/office/Forms";
import { FileList } from "@/components/office/bits";

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const meetings = useMeetings();
  const duties = useDuties();
  const [edit, setEdit] = useState(false);
  const [duty, setDuty] = useState(false);
  if (meetings.loading) return <Spinner />;
  const m = meetings.data.find((x) => x.id === id);
  if (!m) return <ErrorText>Meeting not found.</ErrorText>;
  const linked = duties.data.filter((d) => d.source.type === "meeting" && d.source.id === id);
  const points = m.keyPoints.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <PageHeader title={m.title} subtitle={`${formatDate(m.date)}${m.time ? ` ${m.time}` : ""}${m.venue ? ` · ${m.venue}` : ""}${m.type ? ` · ${m.type}` : ""}`}
        action={<div className="flex gap-2 print:hidden"><Button variant="ghost" onClick={() => window.print()}>Print</Button><Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button>
          <Button variant="ghost" className="text-bad" onClick={async () => { if (confirm("Delete this meeting record?")) { try { await api(`/api/office/meetings/${id}`, "DELETE"); router.push("/office/meetings"); } catch (e) { alert((e as Error).message); } } }}>Delete</Button></div>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {m.agenda && <Card title="Agenda"><p className="whitespace-pre-wrap text-sm">{m.agenda}</p></Card>}
          <Card title="Key points">{points.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{points.map((p, i) => <li key={i}>{p}</li>)}</ul> : <p className="text-sm text-muted">None recorded.</p>}</Card>
          {m.decisions && <Card title="Decisions"><p className="whitespace-pre-wrap text-sm">{m.decisions}</p></Card>}
        </div>
        <div className="space-y-5">
          <Card title="People">{m.chair && <p className="text-sm"><span className="text-muted">Chair:</span> {m.chair}</p>}{m.attendees && <p className="mt-1 text-sm"><span className="text-muted">Attendees:</span> {m.attendees}</p>}</Card>
          <Card title="Documents"><FileList files={m.files} />{!m.files.length && <p className="text-sm text-muted">None.</p>}</Card>
          <Card title="My duties from this meeting" action={<Button variant="soft" className="print:hidden" onClick={() => setDuty(true)}>Add duty</Button>}>
            {!linked.length ? <p className="text-sm text-muted">None.</p> : <ul className="space-y-1 text-sm">{linked.map((d) => <li key={d.id} className="flex justify-between gap-2"><Link href={`/office/duties?id=${d.id}`} className="hover:text-accent">{d.title}</Link><Badge tone={d.status === "done" ? "ok" : "warn"}>{d.status === "done" ? "done" : d.deadline ? formatDate(d.deadline) : "open"}</Badge></li>)}</ul>}
          </Card>
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit meeting">{edit && <MeetingForm m={m} onDone={() => setEdit(false)} />}</Modal>
      <Modal open={duty} onClose={() => setDuty(false)} title="New duty">{duty && <DutyForm source={{ type: "meeting", id, label: `${m.title} (${formatDate(m.date)})` }} onDone={() => setDuty(false)} />}</Modal>
    </>
  );
}
