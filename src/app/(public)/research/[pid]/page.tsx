import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjects } from "@/lib/server/publicData";
import { PageTitle, Section, fmtDate } from "@/components/site/bits";

async function find(pid: string) {
  return (await getProjects()).find((p) => p.id === pid);
}

export async function generateMetadata({ params }: { params: Promise<{ pid: string }> }) {
  const p = await find((await params).pid);
  return p ? { title: p.title, description: p.summary.slice(0, 160) } : { title: "Project" };
}

export default async function Project({ params }: { params: Promise<{ pid: string }> }) {
  const p = await find((await params).pid);
  if (!p) notFound();
  return (
    <>
      <PageTitle title={p.title} lead={`${p.status.replace("_", " ")} · since ${fmtDate(p.startDate)}`} />
      <Section>
        <div className="grid gap-8 md:grid-cols-3">
          <p className="whitespace-pre-line leading-relaxed md:col-span-2">{p.summary || "Details coming soon."}</p>
          <aside className="rounded-2xl border border-line bg-surface p-6 text-sm">
            <h2 className="mb-2 font-semibold">Team</h2>
            {p.members.length ? <ul className="space-y-1">{p.members.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-muted">—</p>}
          </aside>
        </div>
        <p className="mt-10"><Link href="/research" className="text-sm text-accent hover:underline">← All research</Link></p>
      </Section>
    </>
  );
}
