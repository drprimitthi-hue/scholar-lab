import { getInfo } from "@/lib/server/publicData";
import { PageTitle, Section } from "@/components/site/bits";

export const metadata = { title: "Contact" };

export default async function Contact() {
  const info = await getInfo();
  return (
    <>
      <PageTitle title="Contact" />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs font-medium uppercase tracking-wide text-muted">Email</p><p className="mt-2">{info.contactEmail ? <a className="text-accent hover:underline" href={`mailto:${info.contactEmail}`}>{info.contactEmail}</a> : "—"}</p></div>
          <div className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs font-medium uppercase tracking-wide text-muted">Phone</p><p className="mt-2">{info.contactPhone || "—"}</p></div>
          <div className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs font-medium uppercase tracking-wide text-muted">Address</p><p className="mt-2 whitespace-pre-line">{info.address || [info.department, info.institution].filter(Boolean).join("\n") || "—"}</p></div>
        </div>
      </Section>
    </>
  );
}
