"use client";
import { useMemo } from "react";
import { doc } from "firebase/firestore";
import { fs } from "@/lib/client/firebase";
import { useLiveDoc } from "@/lib/client/hooks";
import { useOutputs, useScholars } from "@/lib/client/data";
import { useCv, useOfficeSettings, useRecords, useSemesters } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { buildCv, type CvSection } from "@/lib/domain/office";
import type { CvEntry, CvProfile, SiteContent } from "@/lib/types";

export function useCvData() {
  const ss = useSession();
  const os = useOfficeSettings();
  const cv = useCv();
  const records = useRecords();
  const outputs = useOutputs();
  const scholars = useScholars();
  const sems = useSemesters();
  // "Completed" statuses are configured with the website (Lab website → Content).
  const site = useLiveDoc<SiteContent>(() => (ss.role === "supervisor" ? doc(fs(), "siteContent", "main") : null), `siteContent:${ss.role}`);
  const sections = useMemo(() => buildCv({
    profile: cv.data, sections: os.cvSections, records: records.data, outputs: outputs.data, scholars: scholars.data,
    programmes: ss.settings.programmes, semesters: sems.data, completed: site.data?.completionStatuses ?? [],
  }), [cv.data, os.cvSections, records.data, outputs.data, scholars.data, ss.settings, sems.data, site.data]);
  return { profile: cv.data, sections, loading: cv.loading || records.loading };
}

const yearSpan = (e: CvEntry) => [e.from, e.to].filter(Boolean).join(" – ");

/** The CV itself (screen preview and print). */
export function CvDocument({ profile, sections }: { profile: CvProfile | null; sections: CvSection[] }) {
  const p = profile;
  const contact = [p?.email, p?.phone, p?.website, p?.orcid && `ORCID ${p.orcid}`, p?.scholarUrl].filter(Boolean);
  const Entries = ({ title, list }: { title: string; list: CvEntry[] }) => !list.length ? null : (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="border-b border-line pb-1 text-sm font-semibold uppercase tracking-wide text-accent">{title}</h2>
      <ul className="mt-2 space-y-1.5">{list.map((e, i) => <li key={i} className="grid grid-cols-[7.5rem_1fr] gap-3 text-sm"><span className="text-muted">{yearSpan(e)}</span><span><span className="font-medium">{e.title}</span>{e.place && `, ${e.place}`}{e.note && <span className="block text-xs text-muted">{e.note}</span>}</span></li>)}</ul>
    </section>
  );
  return (
    <article className="cv mx-auto max-w-3xl bg-white p-8 text-ink print:p-0">
      <header>
        <h1 className="text-2xl font-semibold">{p?.name || "Your name"}</h1>
        <p className="text-sm">{[p?.designation, p?.department, p?.institution].filter(Boolean).join(", ")}</p>
        {contact.length > 0 && <p className="mt-1 text-xs text-muted">{contact.join(" · ")}</p>}
        {p?.address && <p className="text-xs text-muted">{p.address}</p>}
      </header>
      {p?.summary && <p className="mt-4 whitespace-pre-wrap text-sm">{p.summary}</p>}
      {p?.researchInterests && <section className="mt-6"><h2 className="border-b border-line pb-1 text-sm font-semibold uppercase tracking-wide text-accent">Research interests</h2><p className="mt-2 text-sm">{p.researchInterests}</p></section>}
      <Entries title="Education" list={p?.education ?? []} />
      <Entries title="Professional experience" list={p?.experience ?? []} />
      {sections.map((s) => (
        <section key={s.id} className="mt-6">
          <h2 className="border-b border-line pb-1 text-sm font-semibold uppercase tracking-wide text-accent">{s.title}</h2>
          <ol className={`mt-2 space-y-1.5 text-sm ${s.id === "publications" || s.id === "patents" ? "list-decimal pl-6" : ""}`}>
            {s.items.map((it, i) => <li key={i} className="break-inside-avoid">{s.id !== "publications" && s.id !== "patents" && it.date && <span className="mr-2 text-muted">{it.date.slice(0, 4)}</span>}{it.text}{it.sub && <span className="block text-xs text-muted">{it.sub}</span>}</li>)}
          </ol>
        </section>
      ))}
    </article>
  );
}
