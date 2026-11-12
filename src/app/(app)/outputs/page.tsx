"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOutputs } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { KIND_LABEL, PIPELINES, stepOf } from "@/lib/domain/outputs";
import type { OutputKind } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Input, Modal, PageHeader, Select, Spinner, Stat, Tabs } from "@/components/ui";
import { Funnel } from "@/components/charts";
import { OutputForm } from "@/components/output/OutputForm";
import { statusTone } from "@/components/output/bits";

export default function OutputsPage() {
  const ss = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = (params.get("kind") ?? "publication") as OutputKind;
  const { data, loading, error } = useOutputs();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [add, setAdd] = useState(false);
  if (loading) return <Spinner />;
  const ofKind = data.filter((o) => o.kind === kind && o.archived === archived);
  const list = ofKind
    .filter((o) => !status || o.status === status)
    .filter((o) => !q || `${o.title} ${o.authors} ${o.venue} ${o.memberNames.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const steps = PIPELINES[kind].filter((s) => s.id !== "rejected");
  const live = data.filter((o) => o.kind === kind && !o.archived && o.status !== "rejected");
  const reached = (idx: number) => live.filter((o) => steps.findIndex((s) => s.id === o.status) >= idx).length;
  const year = String(new Date().getFullYear());
  return (
    <>
      <PageHeader title="Outputs" subtitle="Publications, patents, products, software, datasets and thesis chapters"
        action={ss.role !== "alumni" && <Button onClick={() => setAdd(true)}>Register output</Button>} />
      <ErrorText>{error}</ErrorText>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Publications (accepted or published)" value={data.filter((o) => o.kind === "publication" && ["accepted", "published"].includes(o.status) && !o.archived).length} />
        <Stat label={`Published in ${year}`} value={data.filter((o) => o.kind === "publication" && o.status === "published" && o.year === year && !o.archived).length} />
        <Stat label="Patents filed or later" value={data.filter((o) => o.kind === "patent" && !["idea", "drafting", "rejected"].includes(o.status) && !o.archived).length} />
        <Stat label="Under review now" value={data.filter((o) => ["submitted", "under_review", "revision", "examination", "internal_review", "review"].includes(o.status) && !o.archived).length} />
      </div>
      <Tabs tabs={(Object.keys(KIND_LABEL) as OutputKind[]).map((k) => ({ id: k, label: `${KIND_LABEL[k]} (${data.filter((o) => o.kind === k && !o.archived).length})` }))}
        value={kind} onChange={(k) => { setStatus(""); router.replace(`${pathname}?kind=${k}`, { scroll: false }); }} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-56 py-1.5" placeholder="Search title, author, venue…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select className="w-44 py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{PIPELINES[kind].map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
            <label className="flex items-center gap-1 text-xs font-normal text-muted"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> archived</label>
          </div>}>
          {!list.length ? <Empty>Nothing here yet.</Empty> : (
            <ul className="divide-y divide-line/60">
              {list.map((o) => (
                <li key={o.id} className="py-3">
                  <Link href={`/outputs/${o.id}`} className="font-medium hover:text-accent">{o.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={statusTone(o.kind, o.status)}>{stepOf(o.kind, o.status)?.label ?? o.status}</Badge>
                    {o.public && <Badge tone="ok">on website</Badge>}
                    <span>{[o.venue, o.year].filter(Boolean).join(", ")}</span>
                    {o.memberNames.length > 0 && <span>· {o.memberNames.join(", ")}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`${KIND_LABEL[kind]} pipeline`}>
          {live.length ? <Funnel steps={steps.map((s, i) => ({ label: s.label, value: reached(i) }))} /> : <Empty>No active items.</Empty>}
          <p className="mt-2 text-xs text-muted">How many items have reached each step.</p>
        </Card>
      </div>
      <Modal open={add} onClose={() => setAdd(false)} title="Register an output">
        {add && <OutputForm onDone={(id) => { setAdd(false); if (id) router.push(`/outputs/${id}`); }} />}
      </Modal>
    </>
  );
}
