"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessions } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import type { SessionDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Modal, PageHeader, Spinner } from "@/components/ui";
import { RotaForm, SESSION_TYPES, SessionForm } from "@/components/seminar/SessionForm";

function Row({ s, me }: { s: SessionDoc; me: string }) {
  return (
    <li className="py-3">
      <Link href={`/seminars/${s.id}`} className="flex flex-wrap items-start justify-between gap-2 hover:text-accent">
        <div>
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-muted">{formatDate(s.date)}{s.time && ` · ${s.time}`} · {SESSION_TYPES[s.type]}{s.venue && ` · ${s.venue}`}</p>
          <p className="mt-1 text-sm text-muted">{s.speakers.map((x) => x.name).join(", ") || "No speakers yet"}</p>
        </div>
        <div className="flex gap-1">
          {s.speakerUids.includes(me) && <Badge tone="warn">You speak</Badge>}
          <Badge tone={s.status === "completed" ? "ok" : s.status === "cancelled" ? "neutral" : "accent"}>{s.status}</Badge>
        </div>
      </Link>
    </li>
  );
}

export default function SeminarsPage() {
  const ss = useSession();
  const router = useRouter();
  const { data, loading, error } = useSessions();
  const [open, setOpen] = useState<"new" | "rota" | null>(null);
  if (loading) return <Spinner />;
  const today = todayInTz(ss.settings.timezone);
  const me = ss.user?.uid ?? "";
  const upcoming = data.filter((s) => s.date >= today && s.status === "scheduled").sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const past = data.filter((s) => !(s.date >= today && s.status === "scheduled")).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader title="Seminars" subtitle="Group talks, demos and reviews" action={ss.role === "supervisor" && <div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen("rota")}>Create rota</Button><Button onClick={() => setOpen("new")}>New session</Button></div>} />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Upcoming (${upcoming.length})`}>{!upcoming.length ? <Empty>Nothing scheduled.</Empty> : <ul className="divide-y divide-line/60">{upcoming.map((s) => <Row key={s.id} s={s} me={me} />)}</ul>}</Card>
        <Card title="Past & closed">{!past.length ? <Empty>No past sessions.</Empty> : <ul className="divide-y divide-line/60">{past.slice(0, 50).map((s) => <Row key={s.id} s={s} me={me} />)}</ul>}</Card>
      </div>
      <Modal open={open === "new"} onClose={() => setOpen(null)} title="New session">{open === "new" && <SessionForm onDone={(id) => { setOpen(null); if (id) router.push(`/seminars/${id}`); }} />}</Modal>
      <Modal open={open === "rota"} onClose={() => setOpen(null)} title="Create a speaker rota">{open === "rota" && <RotaForm onDone={() => setOpen(null)} />}</Modal>
    </>
  );
}
