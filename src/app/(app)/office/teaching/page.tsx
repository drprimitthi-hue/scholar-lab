"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDiary, useSemesters } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { DAYS, activeSemester, isTeaching, subjectLabel, teachingSummary } from "@/lib/domain/office";
import { formatDate, todayInTz } from "@/lib/domain/dates";
import type { SemesterDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Modal, PageHeader, Spinner } from "@/components/ui";
import { SemesterForm } from "@/components/office/SemesterForm";

function SubjectLog({ sem, subjectId }: { sem: SemesterDoc; subjectId: string }) {
  const s = sem.subjects.find((x) => x.id === subjectId);
  const { data, loading } = useDiary(sem.startDate, sem.endDate);
  const list = data.filter((e) => e.semesterId === sem.id && e.subjectId === subjectId && isTeaching(e.type)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  if (!s) return <ErrorText>Subject not found.</ErrorText>;
  return (
    <>
      <PageHeader title={subjectLabel(s)} subtitle={`${sem.name} · ${s.programme} · ${list.length} session(s)`} action={<div className="flex gap-2 print:hidden"><Button variant="ghost" onClick={() => window.print()}>Print / save as PDF</Button><Link href="/office/teaching" className="self-center text-sm text-muted">Back</Link></div>} />
      <Card>
        {loading ? <Spinner /> : !list.length ? <Empty>No sessions recorded.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">#</th><th>Date</th><th>Time</th><th>Unit</th><th>Topic</th><th>Room</th><th>Students</th><th>Remark</th></tr></thead>
            <tbody>{list.map((e, i) => <tr key={e.id} className="border-t border-line/60 align-top"><td className="py-1.5">{i + 1}</td><td className="whitespace-nowrap">{formatDate(e.date)}</td><td className="whitespace-nowrap">{e.start}{e.end && `–${e.end}`}</td><td>{e.unit}</td><td>{e.topic}</td><td>{e.room}</td><td>{e.students || ""}</td><td>{e.remark}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export default function TeachingPage() {
  const ss = useSession();
  const params = useSearchParams();
  const today = todayInTz(ss.settings.timezone);
  const sems = useSemesters();
  const sorted = useMemo(() => [...sems.data].sort((a, b) => b.startDate.localeCompare(a.startDate)), [sems.data]);
  const earliest = sorted.at(-1)?.startDate ?? today;
  const diary = useDiary(earliest, "");
  const [form, setForm] = useState<SemesterDoc | "new" | null>(null);
  const sid = params.get("sem");
  const subj = params.get("subject");
  if (sems.loading) return <Spinner />;
  const viewing = sid && subj ? sorted.find((x) => x.id === sid) : undefined;
  if (viewing && subj) return <SubjectLog sem={viewing} subjectId={subj} />;
  const summary = teachingSummary(diary.data, sorted);
  const current = activeSemester(sorted, today);
  return (
    <>
      <PageHeader title="Teaching" subtitle="Subjects per semester and everything taught" action={<Button onClick={() => setForm("new")}>New semester</Button>} />
      <ErrorText>{sems.error || diary.error}</ErrorText>
      {!sorted.length && <Card><Empty>Add your first semester and its subjects.</Empty></Card>}
      <div className="space-y-5">
        {sorted.map((sem) => (
          <Card key={sem.id} title={<span>{sem.name} {sem.id === current?.id && <Badge tone="accent">current</Badge>}</span>}
            action={<div className="flex gap-2"><span className="self-center text-xs text-muted">{formatDate(sem.startDate)}{sem.endDate && ` – ${formatDate(sem.endDate)}`}</span><Button variant="ghost" className="px-3 py-1" onClick={() => setForm(sem)}>Edit</Button>
              <Button variant="ghost" className="px-3 py-1 text-bad" onClick={async () => { if (confirm(`Delete ${sem.name}? Only possible if nothing was recorded.`)) await api(`/api/office/semesters/${sem.id}`, "DELETE").catch((e: Error) => alert(e.message)); }}>Delete</Button></div>}>
            {!sem.subjects.length ? <Empty>No subjects.</Empty> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1">Subject</th><th>Programme</th><th>Usual slots</th><th className="text-right">Sessions</th><th className="text-right">Hours</th><th>Units covered</th><th>Last</th></tr></thead>
                <tbody>{sem.subjects.map((s) => {
                  const r = summary.find((x) => x.semesterId === sem.id && x.subjectId === s.id);
                  return (
                    <tr key={s.id} className="border-t border-line/60">
                      <td className="py-2"><Link className="font-medium hover:text-accent" href={`/office/teaching?sem=${sem.id}&subject=${s.id}`}>{subjectLabel(s)}</Link> {s.kind !== "theory" && <Badge>{s.kind}</Badge>}</td>
                      <td>{s.programme}</td>
                      <td className="text-xs text-muted">{s.slots.map((x) => `${DAYS[x.day]} ${x.start}${x.room ? ` (${x.room})` : ""}`).join(", ")}</td>
                      <td className="text-right">{r?.sessions ?? 0}</td>
                      <td className="text-right">{r ? Math.round(r.minutes / 6) / 10 : 0}</td>
                      <td className="text-xs">{r?.units.join(", ")}{s.units > 0 && r ? <span className="text-muted"> ({r.units.length}/{s.units})</span> : null}</td>
                      <td className="whitespace-nowrap text-xs">{r?.last ? formatDate(r.last) : "—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </Card>
        ))}
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} title={form === "new" ? "New semester" : "Edit semester"}>
        {form && <SemesterForm sem={form === "new" ? undefined : form} copyFrom={sorted} onDone={() => setForm(null)} />}
      </Modal>
    </>
  );
}
