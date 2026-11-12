"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCards, useProjects, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, Empty, ErrorText, Modal, PageHeader, Progress, Spinner } from "@/components/ui";
import { ProjectForm } from "@/components/ProjectForm";

export default function ProjectsPage() {
  const s = useSession();
  const router = useRouter();
  const projects = useProjects();
  const scholars = useScholars();
  const cards = useCards({});
  const [open, setOpen] = useState(false);
  if (projects.loading) return <Spinner />;
  const names = new Map(scholars.data.map((x) => [x.uid, x.name]));
  const list = [...projects.data].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <PageHeader title={s.role === "scholar" ? "My projects" : "Projects"} action={s.role === "supervisor" && <Button onClick={() => setOpen(true)}>New project</Button>} />
      <ErrorText>{projects.error}</ErrorText>
      {!list.length ? <Card><Empty>No projects yet.</Empty></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((p) => {
            const mine = cards.data.filter((c) => c.projectId === p.id);
            const accepted = mine.filter((c) => c.status === "accepted").length;
            const target = Math.max(1, p.itemCount * (s.role === "scholar" ? 1 : Math.max(1, p.scholarUids.length)));
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{p.title}</h2>
                  <Badge tone={p.status === "active" ? "ok" : "neutral"}>{p.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{formatDate(p.startDate)}{p.endDate && ` – ${formatDate(p.endDate)}`} · {p.itemCount} papers</p>
                {s.role !== "scholar" && <p className="mt-2 text-sm text-muted">{p.scholarUids.map((u) => names.get(u) ?? "…").join(", ") || "No scholars yet"}</p>}
                <div className="mt-4 flex items-center gap-2"><Progress value={(accepted / target) * 100} /><span className="whitespace-nowrap text-xs text-muted">{accepted} accepted</span></div>
              </Link>
            );
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        {open && <ProjectForm onDone={(id) => { setOpen(false); if (id) router.push(`/projects/${id}?tab=literature`); }} />}
      </Modal>
    </>
  );
}
