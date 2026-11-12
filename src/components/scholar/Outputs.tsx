"use client";
import Link from "next/link";
import { useOutputs, useProjects, usePrototypes } from "@/lib/client/data";
import { KIND_LABEL, TRL_LABEL, stageProgress, stepOf } from "@/lib/domain/outputs";
import type { OutputKind, ScholarDoc } from "@/lib/types";
import { Badge, Card, Empty, Progress, Stat } from "@/components/ui";
import { statusTone } from "@/components/output/bits";

function OwnedPrototypes({ pid, uid }: { pid: string; uid: string }) {
  const { data } = usePrototypes(pid);
  return <>{data.filter((p) => p.ownerUids.includes(uid)).map((p) => (
    <li key={p.id} className="py-2 text-sm">
      <Link href={`/projects/${pid}/prototypes/${p.id}`} className="font-medium hover:text-accent">{p.title}</Link>
      <div className="mt-1 flex items-center gap-2"><Progress value={stageProgress(p.stages)} /><span className="whitespace-nowrap text-xs text-muted">{p.trl ? `TRL ${p.trl}` : "TRL —"}</span></div>
    </li>
  ))}</>;
}

export function OutputsTab({ scholar }: { scholar: ScholarDoc }) {
  const outputs = useOutputs();
  const projects = useProjects();
  const mine = outputs.data.filter((o) => o.memberUids.includes(scholar.uid) && !o.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const count = (k: OutputKind, statuses?: string[]) => mine.filter((o) => o.kind === k && (!statuses || statuses.includes(o.status))).length;
  const theirProjects = projects.data.filter((p) => p.scholarUids.includes(scholar.uid));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Papers accepted / published" value={count("publication", ["accepted", "published"])} hint={`${count("publication")} registered`} />
        <Stat label="Patents filed or later" value={count("patent", ["filed", "published", "examination", "granted"])} />
        <Stat label="Products · software · datasets" value={count("product") + count("software") + count("dataset")} />
        <Stat label="Thesis chapters final" value={count("thesis_chapter", ["final"])} hint={`${count("thesis_chapter")} started`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Outputs" className="lg:col-span-2" action={<Link href="/outputs" className="text-sm text-accent">Outputs register</Link>}>
          {!mine.length ? <Empty>No outputs yet.</Empty> : (
            <ul className="divide-y divide-line/60">{mine.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><Link href={`/outputs/${o.id}`} className="hover:text-accent">{o.title}</Link> <span className="text-xs text-muted">· {KIND_LABEL[o.kind]}{o.year && `, ${o.year}`}</span></span>
                <Badge tone={statusTone(o.kind, o.status)}>{stepOf(o.kind, o.status)?.label}</Badge>
              </li>
            ))}</ul>
          )}
        </Card>
        <Card title="Prototypes owned">
          <ul className="divide-y divide-line/60">{theirProjects.map((p) => <OwnedPrototypes key={p.id} pid={p.id} uid={scholar.uid} />)}</ul>
          <p className="mt-2 text-xs text-muted">TRL 1 = {TRL_LABEL[1]!.toLowerCase()}; 9 = {TRL_LABEL[9]!.toLowerCase()}.</p>
        </Card>
      </div>
    </div>
  );
}
