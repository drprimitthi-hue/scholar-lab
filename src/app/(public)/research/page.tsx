import Link from "next/link";
import { getInfo, getProjects } from "@/lib/server/publicData";
import { Empty, PageTitle, Section, fmtDate } from "@/components/site/bits";

export const metadata = { title: "Research" };

export default async function Research() {
  const [info, projects] = await Promise.all([getInfo(), getProjects()]);
  const sorted = [...projects].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || b.startDate.localeCompare(a.startDate));
  return (
    <>
      <PageTitle title="Research" lead={info.tagline} />
      {info.about && <Section title="About the lab"><p className="max-w-3xl whitespace-pre-line leading-relaxed">{info.about}</p></Section>}
      {info.themes.length > 0 && (
        <Section title="Themes">
          <div className="grid gap-4 md:grid-cols-2">
            {info.themes.map((t) => <div key={t.title} className="rounded-2xl border border-line bg-surface p-6"><h3 className="text-lg font-semibold">{t.title}</h3><p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{t.summary}</p></div>)}
          </div>
        </Section>
      )}
      <Section title="Projects">
        {!sorted.length ? <Empty>Public project pages will appear here.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2">
            {sorted.map((p) => (
              <Link key={p.id} href={`/research/${p.id}`} className="block rounded-2xl border border-line bg-surface p-6 transition hover:border-accent/50">
                <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{p.title}</h3><span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs capitalize text-accent">{p.status.replace("_", " ")}</span></div>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{p.summary}</p>
                <p className="mt-3 text-xs text-muted">Since {fmtDate(p.startDate)}{p.members.length ? ` · ${p.members.join(", ")}` : ""}</p>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
