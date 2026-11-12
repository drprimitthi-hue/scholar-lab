import Link from "next/link";
import { getInfo, getNews, getOpenings, getPeople, getProjects, getPublications } from "@/lib/server/publicData";
import { Empty, More, Section, fmtDate } from "@/components/site/bits";

export default async function Home() {
  const [info, people, projects, news, openings, pubs] = await Promise.all([getInfo(), getPeople(), getProjects(), getNews(), getOpenings(), getPublications()]);
  const stats = [
    { label: "Current scholars", value: people.filter((p) => p.group === "current").length },
    { label: "Active projects", value: projects.filter((p) => p.status === "active").length },
    { label: "Publications", value: pubs.length },
    { label: "Alumni", value: people.filter((p) => p.group === "alumni").length },
  ];
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          {info.department && <p className="text-sm font-medium uppercase tracking-widest text-accent">{info.department}</p>}
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{info.labName}</h1>
          {info.tagline && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{info.tagline}</p>}
          {info.supervisorName && <p className="mt-6 text-sm">Led by <Link href="/people" className="font-medium text-accent hover:underline">{info.supervisorName}</Link>{info.piTitle && `, ${info.piTitle}`}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/research" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">Our research</Link>
            {openings.length > 0 && <Link href="/join" className="rounded-lg border border-accent px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent/5">{openings.length} open position{openings.length > 1 ? "s" : ""}</Link>}
          </div>
        </div>
      </section>

      <Section>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => <div key={s.label} className="rounded-2xl border border-line bg-surface p-5"><dt className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</dt><dd className="mt-2 text-3xl font-semibold">{s.value}</dd></div>)}
        </dl>
      </Section>

      {info.themes.length > 0 && (
        <Section title="Research themes" action={<More href="/research">All research</More>}>
          <div className="grid gap-4 md:grid-cols-3">
            {info.themes.slice(0, 6).map((t) => <div key={t.title} className="rounded-2xl border border-line bg-surface p-6"><h3 className="font-semibold">{t.title}</h3><p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted">{t.summary}</p></div>)}
          </div>
        </Section>
      )}

      <Section title="Latest news" action={news.length > 3 && <More href="/news">All news</More>}>
        {!news.length ? <Empty>News will appear here.</Empty> : (
          <div className="grid gap-4 md:grid-cols-3">
            {news.slice(0, 3).map((n) => <article key={n.id} className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs text-muted">{fmtDate(n.date)}</p><h3 className="mt-2 font-semibold">{n.title}</h3><p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-muted">{n.body}</p></article>)}
          </div>
        )}
      </Section>
    </>
  );
}
