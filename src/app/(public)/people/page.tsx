import { getInfo, getPeople } from "@/lib/server/publicData";
import { Avatar, Empty, Ext, PageTitle, Section } from "@/components/site/bits";
import type { Level, PublicPerson } from "@/lib/types";

export const metadata = { title: "People" };
const LEVELS: { level: Level; title: string }[] = [
  { level: "phd", title: "Doctoral scholars" },
  { level: "master", title: "Master's scholars" },
  { level: "bachelor", title: "Undergraduate scholars" },
];

function Person({ p }: { p: PublicPerson }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
      <Avatar name={p.name} />
      <div className="min-w-0"><p className="font-semibold">{p.name}</p><p className="text-sm text-muted">{p.programme}{p.since && ` · ${p.group === "alumni" && p.until ? `${p.since}–${p.until}` : `since ${p.since}`}`}</p>{p.topic && <p className="mt-1 text-sm">{p.topic}</p>}</div>
    </div>
  );
}

export default async function People() {
  const [info, people] = await Promise.all([getInfo(), getPeople()]);
  const current = people.filter((p) => p.group === "current").sort((a, b) => a.name.localeCompare(b.name));
  const alumni = people.filter((p) => p.group === "alumni").sort((a, b) => b.until.localeCompare(a.until) || a.name.localeCompare(b.name));
  const links = Object.entries(info.links).filter(([, v]) => v);
  const LINK_LABEL: Record<string, string> = { website: "Website", orcid: "ORCID", scholar: "Google Scholar", scopus: "Scopus", linkedin: "LinkedIn" };
  return (
    <>
      <PageTitle title="People" />
      {info.supervisorName && (
        <Section title="Principal investigator">
          <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-8 md:flex-row">
            <Avatar name={info.supervisorName} size={96} />
            <div>
              <p className="text-xl font-semibold">{info.supervisorName}</p>
              {info.piTitle && <p className="text-muted">{info.piTitle}</p>}
              {info.piBio && <p className="mt-4 max-w-3xl whitespace-pre-line leading-relaxed">{info.piBio}</p>}
              {links.length > 0 && <p className="mt-4 flex flex-wrap gap-4 text-sm">{links.map(([k, v]) => <Ext key={k} href={v}>{LINK_LABEL[k] ?? k}</Ext>)}</p>}
            </div>
          </div>
        </Section>
      )}
      {LEVELS.map(({ level, title }) => {
        const group = current.filter((p) => p.level === level);
        return group.length ? <Section key={level} title={title}><div className="grid gap-4 md:grid-cols-2">{group.map((p) => <Person key={p.uid} p={p} />)}</div></Section> : null;
      })}
      {!current.length && <Section><Empty>Lab members who agree to be listed will appear here.</Empty></Section>}
      {alumni.length > 0 && <Section title="Alumni"><div className="grid gap-4 md:grid-cols-2">{alumni.map((p) => <Person key={p.uid} p={p} />)}</div></Section>}
    </>
  );
}
