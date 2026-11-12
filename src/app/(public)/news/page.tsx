import { getNews } from "@/lib/server/publicData";
import { Empty, Ext, PageTitle, Section, fmtDate } from "@/components/site/bits";

export const metadata = { title: "News" };

export default async function News() {
  const news = await getNews();
  return (
    <>
      <PageTitle title="News" />
      <Section>
        {!news.length ? <Empty>No news yet.</Empty> : (
          <div className="space-y-4">
            {news.map((n) => (
              <article key={n.id} className="rounded-2xl border border-line bg-surface p-6">
                <p className="text-xs text-muted">{fmtDate(n.date)}</p>
                <h2 className="mt-1 text-lg font-semibold">{n.title}</h2>
                {n.body && <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{n.body}</p>}
                {n.link && <p className="mt-3 text-sm"><Ext href={n.link}>Read more</Ext></p>}
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
