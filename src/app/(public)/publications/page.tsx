import { getPublications } from "@/lib/server/publicData";
import { Empty, Ext, PageTitle, Section } from "@/components/site/bits";

export const metadata = { title: "Publications" };

export default async function Publications() {
  const pubs = await getPublications();
  const years = [...new Set(pubs.map((p) => p.year))];
  return (
    <>
      <PageTitle title="Publications" lead={pubs.length ? `${pubs.length} publications` : undefined} />
      <Section>
        {!pubs.length ? <Empty>Publications will be listed here.</Empty> : years.map((y) => (
          <div key={y} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold">{y}</h2>
            <ol className="space-y-4">
              {pubs.filter((p) => p.year === y).map((p) => (
                <li key={p.id} className="rounded-xl border border-line bg-surface p-5">
                  <p className="font-medium">{p.url ? <Ext href={p.url}>{p.title}</Ext> : p.title}</p>
                  <p className="mt-1 text-sm text-muted">{p.authors}</p>
                  <p className="mt-1 text-sm"><em>{p.venue}</em> <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs capitalize text-muted">{p.type}</span></p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </Section>
    </>
  );
}
