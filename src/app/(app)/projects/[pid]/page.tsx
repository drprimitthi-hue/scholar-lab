"use client";
import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useGroupCards, useProject, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, Empty, ErrorText, Modal, PageHeader, Spinner, Tabs } from "@/components/ui";
import { ProjectForm } from "@/components/ProjectForm";
import { Literature } from "@/components/project/Literature";
import { Plans } from "@/components/project/Plans";
import { Progress } from "@/components/project/Progress";
import { Synthesis } from "@/components/project/Synthesis";
import { Suggestions } from "@/components/project/Suggestions";
import { CardView } from "@/components/project/CardView";
import { Concepts } from "@/components/project/Concepts";
import { Prototypes } from "@/components/project/Prototypes";
import type { ProjectDoc } from "@/lib/types";

const RELEASE = { both: "on its date, after the previous batch is done", date: "on its date", gated: "after the previous batch is done" };

function Overview({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const scholars = useScholars();
  const names = scholars.data.filter((x) => project.scholarUids.includes(x.uid));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="About">
        <p className="whitespace-pre-wrap text-sm">{project.objectives || <span className="text-muted">No objectives written yet.</span>}</p>
        <dl className="mt-4 space-y-1 text-sm">
          <div><span className="text-muted">Dates: </span>{formatDate(project.startDate)}{project.endDate && ` – ${formatDate(project.endDate)}`}</div>
          <div><span className="text-muted">Papers: </span>{project.itemCount}</div>
          <div><span className="text-muted">Each batch is released </span>{RELEASE[project.releaseMode]}{project.releaseMode !== "date" && ` (${Math.round(project.gateThreshold * 100)}% accepted)`}</div>
          <div><span className="text-muted">Reading Card fields need at least </span>{project.minWords} words</div>
          <div><span className="text-muted">Reading Cards & Concept Notes shared with group: </span>{project.cardsVisibleToGroup ? "Yes (accepted ones)" : "No"}</div>
        </dl>
      </Card>
      <Card title="Scholars">
        {!names.length ? <Empty>None yet.</Empty> : <ul className="space-y-1 text-sm">{names.map((n) => <li key={n.uid}>{s.role === "scholar" ? n.name : <Link href={`/scholars/${n.uid}`} className="hover:text-accent">{n.name}</Link>}</li>)}</ul>}
      </Card>
    </div>
  );
}

function Shared({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const { data, loading, error } = useGroupCards(project.id, project.cardsVisibleToGroup);
  if (loading) return <Spinner />;
  const others = data.filter((c) => c.uid !== s.user?.uid);
  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      {!others.length ? <Card><Empty>No shared cards yet.</Empty></Card> : others.map((c) => (
        <Card key={c.id} title={c.itemTitle} action={<Badge>{c.scholarName}</Badge>}><CardView c={c} /></Card>
      ))}
    </div>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = use(params);
  const s = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "overview";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const { data, loading, error } = useProject(pid);
  const [edit, setEdit] = useState(false);
  if (loading) return <Spinner />;
  if (!data) return <ErrorText>{error ?? "Project not found."}</ErrorText>;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "literature", label: "Literature" },
    ...(s.role !== "scholar" ? [{ id: "plans", label: "Reading plans" }] : []),
    { id: "concepts", label: "Concepts" },
    { id: "prototypes", label: "Prototypes" },
    { id: "progress", label: "Progress" },
    { id: "synthesis", label: "Synthesis" },
    { id: "suggestions", label: "Suggestions" },
    ...(s.role === "scholar" && data.cardsVisibleToGroup ? [{ id: "shared", label: "Group cards" }] : []),
  ];
  return (
    <>
      <PageHeader title={data.title} subtitle={`${data.status.replace("_", " ")} · ${data.itemCount} papers`}
        action={s.role === "supervisor" ? <Button variant="ghost" onClick={() => setEdit(true)}>Edit project</Button> : s.role === "scholar" ? <Link href="/reading" className="text-sm text-accent">Go to today&apos;s reading →</Link> : null} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview project={data} />}
      {tab === "literature" && <Literature project={data} />}
      {tab === "plans" && s.role !== "scholar" && <Plans project={data} />}
      {tab === "concepts" && <Concepts project={data} />}
      {tab === "prototypes" && <Prototypes project={data} />}
      {tab === "progress" && <Progress project={data} />}
      {tab === "synthesis" && <Synthesis project={data} />}
      {tab === "suggestions" && <Suggestions project={data} />}
      {tab === "shared" && <Shared project={data} />}
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit project">{edit && <ProjectForm project={data} onDone={() => setEdit(false)} />}</Modal>
    </>
  );
}
