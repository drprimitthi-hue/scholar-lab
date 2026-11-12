"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMeetings, useOfficeSettings } from "@/lib/client/office";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { MeetingForm } from "@/components/office/Forms";

export default function MeetingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const os = useOfficeSettings();
  const { data, loading } = useMeetings();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const [add, setAdd] = useState(params.get("new") === "1");
  const years = [...new Set(data.map((m) => m.date.slice(0, 4)))].sort().reverse();
  const list = data.filter((m) => (!type || m.type === type) && (!year || m.date.startsWith(year)) && (!q || `${m.title} ${m.keyPoints} ${m.decisions} ${m.chair}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return (
    <>
      <PageHeader title="Meetings" subtitle={`${list.length} meeting(s)`} action={<Button onClick={() => setAdd(true)}>Record a meeting</Button>} />
      <Card className="mb-5"><div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search title, key points, decisions…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{[...new Set([...os.meetingTypes, ...data.map((m) => m.type).filter(Boolean)])].map((t) => <option key={t}>{t}</option>)}</Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</Select>
      </div></Card>
      {loading ? <Spinner /> : !list.length ? <Card><Empty>No meetings recorded.</Empty></Card> : (
        <Card><ul className="divide-y divide-line/60">{list.map((m) => (
          <li key={m.id} className="py-3">
            <Link href={`/office/meetings/${m.id}`} className="font-medium hover:text-accent">{m.title}</Link>
            <p className="text-xs text-muted">{formatDate(m.date)}{m.time && ` ${m.time}`}{m.venue && ` · ${m.venue}`} {m.type && <Badge>{m.type}</Badge>} {m.files.length > 0 && `· ${m.files.length} file(s)`}</p>
            {m.keyPoints && <p className="mt-1 line-clamp-2 text-sm text-muted">{m.keyPoints.split("\n").filter(Boolean).join(" · ")}</p>}
          </li>
        ))}</ul></Card>
      )}
      <Modal open={add} onClose={() => setAdd(false)} title="Record a meeting">{add && <MeetingForm onDone={(id) => { setAdd(false); router.push(`/office/meetings/${id}`); }} />}</Modal>
    </>
  );
}
