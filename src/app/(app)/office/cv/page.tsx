"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useOfficeSettings } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { AUTO_SECTIONS } from "@/lib/domain/office";
import type { CvEntry, CvProfile } from "@/lib/types";
import { Button, Card, ErrorText, Field, Input, Notice, PageHeader, Spinner, Textarea, useAction } from "@/components/ui";
import { CvDocument, useCvData } from "@/components/office/Cv";

type Draft = Omit<CvProfile, "updatedAt">;
const blank: CvEntry = { title: "", place: "", from: "", to: "", note: "" };

function EntryList({ label, value, onChange, titleHint }: { label: string; value: CvEntry[]; onChange: (v: CvEntry[]) => void; titleHint: string }) {
  const up = (i: number, k: keyof CvEntry, v: string) => onChange(value.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div className="space-y-2">{value.map((e, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 sm:grid-cols-[2fr_2fr_5rem_5rem_auto]">
          <Input placeholder={titleHint} value={e.title} onChange={(x) => up(i, "title", x.target.value)} />
          <Input placeholder="Institution / organisation" value={e.place} onChange={(x) => up(i, "place", x.target.value)} />
          <Input placeholder="From" value={e.from} onChange={(x) => up(i, "from", x.target.value)} />
          <Input placeholder="To" value={e.to} onChange={(x) => up(i, "to", x.target.value)} />
          <button className="text-xs text-muted hover:text-bad" onClick={() => onChange(value.filter((_, j) => j !== i))}>remove</button>
          <Input className="col-span-2 sm:col-span-5" placeholder="Note (thesis title, specialisation, grade…)" value={e.note} onChange={(x) => up(i, "note", x.target.value)} />
        </div>
      ))}</div>
      <button className="mt-1 text-xs text-accent" onClick={() => onChange([...value, { ...blank }])}>+ add</button>
    </div>
  );
}

function Editor({ initial }: { initial: Draft }) {
  const os = useOfficeSettings();
  const [f, setF] = useState<Draft>(initial);
  const a = useAction();
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Profile and fixed sections">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={f.name} onChange={set("name")} /></Field>
          <Field label="Designation"><Input value={f.designation} onChange={set("designation")} /></Field>
          <Field label="Department"><Input value={f.department} onChange={set("department")} /></Field>
          <Field label="Institution"><Input value={f.institution} onChange={set("institution")} /></Field>
          <Field label="Email"><Input value={f.email} onChange={set("email")} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
          <Field label="ORCID"><Input value={f.orcid} onChange={set("orcid")} /></Field>
          <Field label="Google Scholar / profile link"><Input value={f.scholarUrl} onChange={set("scholarUrl")} placeholder="https://…" /></Field>
          <Field label="Website"><Input value={f.website} onChange={set("website")} placeholder="https://…" /></Field>
          <Field label="Address"><Input value={f.address} onChange={set("address")} /></Field>
        </div>
        <Field label="Profile summary"><Textarea rows={3} value={f.summary} onChange={set("summary")} /></Field>
        <Field label="Research interests"><Textarea rows={2} value={f.researchInterests} onChange={set("researchInterests")} /></Field>
        <EntryList label="Education" value={f.education} onChange={(education) => setF({ ...f, education })} titleHint="Degree (e.g. Ph.D. Physics)" />
        <EntryList label="Professional experience" value={f.experience} onChange={(experience) => setF({ ...f, experience })} titleHint="Position" />
        <div>
          <p className="mb-1 text-sm font-medium">Sections shown</p>
          <div className="grid gap-1 sm:grid-cols-2">{os.cvSections.map((s) => (
            <label key={s.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!f.hiddenSections.includes(s.id)} onChange={(e) => setF({ ...f, hiddenSections: e.target.checked ? f.hiddenSections.filter((x) => x !== s.id) : [...f.hiddenSections, s.id] })} />
              <span>{s.title}{AUTO_SECTIONS[s.id] && <span className="block text-xs text-muted">Auto: {AUTO_SECTIONS[s.id]}</span>}</span></label>
          ))}</div>
          <p className="mt-2 text-xs text-muted">Other entries come from Records: choose “Show in CV under …” on a record. Sections with nothing in them are left out.</p>
        </div>
        <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
        <Button disabled={a.busy} onClick={() => a.run(() => api("/api/office/cv", "PUT", f), "CV saved")}>Save</Button>
      </div>
    </Card>
  );
}

export default function CvPage() {
  const ss = useSession();
  const { profile, sections, loading } = useCvData();
  if (loading) return <Spinner />;
  const initial: Draft = {
    name: ss.settings.supervisorName, designation: "", department: ss.settings.department, institution: ss.settings.institution, email: ss.user?.email ?? "",
    phone: "", address: "", orcid: "", scholarUrl: "", website: "", summary: "", researchInterests: "", education: [], experience: [], hiddenSections: [],
    ...(profile ?? {}),
  };
  delete (initial as Partial<CvProfile>).updatedAt;
  return (
    <>
      <PageHeader title="Curriculum vitae" subtitle="Always up to date from your records, the lab’s outputs, your scholars and semesters" action={<Link href="/office/cv/print" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">Download / print PDF</Link>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Editor key={profile?.updatedAt ?? 0} initial={initial} />
        <Card title="Preview"><div className="max-h-[80vh] overflow-y-auto rounded-xl border border-line"><CvDocument profile={profile} sections={sections} /></div></Card>
      </div>
    </>
  );
}
