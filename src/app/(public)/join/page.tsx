import { getInfo, getOpenings } from "@/lib/server/publicData";
import { Empty, PageTitle, Section, fmtDate } from "@/components/site/bits";

export const metadata = { title: "Join us" };

export default async function Join() {
  const [info, openings] = await Promise.all([getInfo(), getOpenings()]);
  return (
    <>
      <PageTitle title="Join us" lead="Open positions for scholars and project staff." />
      <Section>
        {!openings.length ? (
          <Empty>There are no open positions right now.{info.contactEmail ? ` You may still write to ${info.contactEmail}.` : ""}</Empty>
        ) : (
          <div className="space-y-4">
            {openings.map((o) => (
              <article key={o.id} className="rounded-2xl border border-line bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{o.title}</h2>{o.deadline && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-warn">Apply by {fmtDate(o.deadline)}</span>}</div>
                {o.description && <p className="mt-3 whitespace-pre-line leading-relaxed">{o.description}</p>}
                {o.eligibility && <><h3 className="mt-4 text-sm font-semibold">Eligibility</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{o.eligibility}</p></>}
                {o.contact && <p className="mt-4 text-sm"><span className="text-muted">How to apply:</span> {o.contact}</p>}
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
