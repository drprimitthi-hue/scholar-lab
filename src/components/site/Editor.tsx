"use client";
import { useState } from "react";
import { collection, doc } from "firebase/firestore";
import { fs } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { useLiveDoc, useLiveQuery } from "@/lib/client/hooks";
import { useScholars, useUsers } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { DEFAULT_SITE } from "@/lib/domain/defaults";
import { todayInTz } from "@/lib/domain/dates";
import type { NewsItem, Opening, Publication, SiteContent } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Notice, Select, Spinner, Textarea, useAction } from "../ui";
import { programmeName } from "../scholar-bits";

export function ContentEditor() {
  const { data, loading } = useLiveDoc<SiteContent>(() => doc(fs(), "siteContent", "main"), "siteContent");
  if (loading) return <Spinner />;
  return <ContentForm key={JSON.stringify(data)} initial={{ ...DEFAULT_SITE, ...(data ?? {}) }} />;
}

function ContentForm({ initial }: { initial: SiteContent }) {
  const [f, setF] = useState<SiteContent>(initial);
  const [statuses, setStatuses] = useState(initial.completionStatuses.join("\n"));
  const a = useAction();
  const s = useSession();
  const link = (k: keyof SiteContent["links"], label: string) => <Field label={label}><Input placeholder="https://…" value={f.links[k]} onChange={(e) => setF({ ...f, links: { ...f.links, [k]: e.target.value } })} /></Field>;
  return (
    <form className="space-y-5" onSubmit={async (e) => { e.preventDefault(); await a.run(() => api("/api/site", "PUT", { ...f, completionStatuses: statuses.split("\n").map((x) => x.trim()).filter(Boolean) }), "Saved — the website updates within a minute."); }}>
      <Card title="About the lab">
        <p className="mb-3 text-sm text-muted">Lab name, institution, tagline and colour are set in Settings → General.</p>
        <Textarea rows={6} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />
      </Card>
      <Card title="Research themes" action={<Button type="button" variant="ghost" disabled={f.themes.length >= 12} onClick={() => setF({ ...f, themes: [...f.themes, { title: "", summary: "" }] })}>Add theme</Button>}>
        {!f.themes.length && <p className="text-sm text-muted">No themes yet.</p>}
        <div className="space-y-3">
          {f.themes.map((t, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex gap-2"><Input placeholder="Theme title" value={t.title} onChange={(e) => setF({ ...f, themes: f.themes.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <Button type="button" variant="ghost" onClick={() => setF({ ...f, themes: f.themes.filter((_, j) => j !== i) })}>✕</Button></div>
              <Textarea className="mt-2" rows={2} placeholder="Short description" value={t.summary} onChange={(e) => setF({ ...f, themes: f.themes.map((x, j) => (j === i ? { ...x, summary: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
      </Card>
      <Card title={`Principal investigator · ${s.settings.supervisorName || "(name in Settings)"}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title / designation"><Input value={f.piTitle} onChange={(e) => setF({ ...f, piTitle: e.target.value })} /></Field>
          {link("website", "Personal website")}{link("orcid", "ORCID")}{link("scholar", "Google Scholar")}{link("scopus", "Scopus")}{link("linkedin", "LinkedIn")}
        </div>
        <div className="mt-3"><Field label="Short bio"><Textarea rows={4} value={f.piBio} onChange={(e) => setF({ ...f, piBio: e.target.value })} /></Field></div>
      </Card>
      <Card title="Contact">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Email"><Input type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></Field>
        </div>
        <div className="mt-3"><Field label="Address"><Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
      </Card>
      <Card title="Automatic news">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.autoPublishNews} onChange={(e) => setF({ ...f, autoPublishNews: e.target.checked })} />Publish automatic news straight away (otherwise they wait in News as drafts for your one click)</label>
        <div className="mt-3"><Field label="Enrolment statuses that mean 'completed' (one per line) — create a congratulation post and move the person to Alumni"><Textarea rows={2} value={statuses} onChange={(e) => setStatuses(e.target.value)} /></Field></div>
      </Card>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Saving…" : "Save website content"}</Button>
    </form>
  );
}

type Kind = "news" | "openings" | "publications";
const SOURCE: Record<Kind, string> = { news: "siteNews", openings: "siteOpenings", publications: "sitePublications" };

function ItemForm({ kind, item, onDone }: { kind: Kind; item: Record<string, unknown> | null; onDone: () => void }) {
  const s = useSession();
  const blank: Record<Kind, Record<string, unknown>> = {
    news: { title: "", body: "", date: todayInTz(s.settings.timezone), link: "", published: true },
    openings: { title: "", description: "", eligibility: "", deadline: "", contact: "", open: true },
    publications: { authors: "", title: "", venue: "", year: String(new Date().getFullYear()), type: "journal", url: "" },
  };
  const keys = Object.keys(blank[kind]);
  const [f, setF] = useState<Record<string, unknown>>(() => Object.fromEntries(keys.map((k) => [k, item?.[k] ?? blank[kind][k]])));
  const a = useAction();
  const t = (k: string, label: string, area = false, type = "text") => (
    <Field label={label}>{area ? <Textarea rows={4} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <Input type={type} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Field>
  );
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => (item ? api(`/api/site/${kind}/${String(item.id)}`, "PATCH", f) : api(`/api/site/${kind}`, "POST", f)))) onDone(); }}>
      {kind === "news" && <>{t("title", "Title")}{t("date", "Date", false, "date")}{t("body", "Text", true)}{t("link", "Link (optional)")}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.published)} onChange={(e) => setF({ ...f, published: e.target.checked })} />Published</label></>}
      {kind === "openings" && <>{t("title", "Position")}{t("description", "Description", true)}{t("eligibility", "Eligibility", true)}{t("deadline", "Apply by (optional)", false, "date")}{t("contact", "How to apply")}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.open)} onChange={(e) => setF({ ...f, open: e.target.checked })} />Open (shown on the website)</label></>}
      {kind === "publications" && <>{t("authors", "Authors")}{t("title", "Title")}{t("venue", "Journal / conference / publisher")}
        <div className="grid grid-cols-2 gap-3">{t("year", "Year")}<Field label="Type"><Select value={String(f.type)} onChange={(e) => setF({ ...f, type: e.target.value })}>{["journal", "conference", "book", "chapter", "patent", "other"].map((x) => <option key={x}>{x}</option>)}</Select></Field></div>{t("url", "Link / DOI URL (optional)")}</>}
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>Save</Button>
    </form>
  );
}

export function ItemsEditor({ kind }: { kind: Kind }) {
  const { data, loading, error } = useLiveQuery<Record<string, unknown> & { id: string }>(() => collection(fs(), SOURCE[kind]), `site:${kind}`);
  const [edit, setEdit] = useState<Record<string, unknown> | "new" | null>(null);
  const a = useAction();
  if (loading) return <Spinner />;
  const label = { news: "News", openings: "Open positions", publications: "Publications" }[kind];
  const list = [...data].sort((x, y) => String(y.date ?? y.year ?? "").localeCompare(String(x.date ?? x.year ?? "")) || Number(y.createdAt) - Number(x.createdAt));
  return (
    <Card title={label} action={<Button onClick={() => setEdit("new")}>Add</Button>}>
      <ErrorText>{error || a.error}</ErrorText>
      {kind === "publications" && <p className="mb-3 text-xs text-muted">Add publications here for now; from Phase 5 accepted papers from the outputs register are added automatically.</p>}
      {!list.length ? <Empty>Nothing yet.</Empty> : (
        <ul className="divide-y divide-line/60">
          {list.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{String(x.title)}</p>
                <p className="text-xs text-muted">{kind === "news" ? `${String(x.date)}${x.auto ? " · automatic" : ""}` : kind === "openings" ? (x.deadline ? `Apply by ${String(x.deadline)}` : "No deadline") : `${String(x.authors)} · ${String(x.venue)} · ${String(x.year)}`}</p>
              </div>
              {kind === "news" && <Badge tone={x.published ? "ok" : "warn"}>{x.published ? "Published" : "Draft"}</Badge>}
              {kind === "openings" && <Badge tone={x.open ? "ok" : "neutral"}>{x.open ? "Open" : "Closed"}</Badge>}
              {kind === "news" && !x.published && <Button variant="soft" className="px-3 py-1" onClick={() => a.run(() => api(`/api/site/news/${x.id}`, "PATCH", { title: x.title, body: x.body, date: x.date, link: x.link ?? "", published: true }))}>Publish</Button>}
              <Button variant="ghost" className="px-3 py-1" onClick={() => setEdit(x)}>Edit</Button>
              <Button variant="ghost" className="px-3 py-1 text-bad" onClick={() => confirm("Delete this item?") && a.run(() => api(`/api/site/${kind}/${x.id}`, "DELETE"))}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? `Add — ${label}` : `Edit — ${label}`}>
        {edit !== null && <ItemForm kind={kind} item={edit === "new" ? null : edit} onDone={() => setEdit(null)} />}
      </Modal>
    </Card>
  );
}

export function PeopleEditor() {
  const s = useSession();
  const scholars = useScholars();
  const users = useUsers();
  const a = useAction();
  if (scholars.loading) return <Spinner />;
  const status = new Map(users.data.map((u) => [u.uid, u]));
  const list = scholars.data.filter((x) => !x.deletion).sort((x, y) => x.name.localeCompare(y.name));
  return (
    <Card title="People on the website">
      <p className="mb-4 text-sm text-muted">A scholar appears only if <b>they</b> agreed (in their own record) and you have not hidden them. Only name, programme, research topic and years are shown — never contact details or records.</p>
      <ErrorText>{a.error}</ErrorText>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2">Scholar</th><th>Their consent</th><th>Shown</th><th></th></tr></thead>
        <tbody>
          {list.map((x) => {
            const shown = x.publicConsent && !x.publicHidden && status.get(x.uid)?.status === "active";
            return (
              <tr key={x.uid} className="border-b border-line/60 last:border-0">
                <td className="py-2.5">{x.name}<div className="text-xs text-muted">{programmeName(s.settings, x.programmeId)}</div></td>
                <td>{x.publicConsent ? <Badge tone="ok">Agreed</Badge> : <Badge>Not given</Badge>}</td>
                <td>{shown ? <Badge tone="accent">On website</Badge> : <Badge>Hidden</Badge>}</td>
                <td className="text-right">{x.publicConsent && <Button variant="ghost" className="px-3 py-1" onClick={() => a.run(() => api(`/api/scholars/${x.uid}/public`, "PATCH", { hidden: !x.publicHidden }))}>{x.publicHidden ? "Allow" : "Hide"}</Button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function SiteTools() {
  const a = useAction();
  return (
    <Card title="Tools">
      <div className="flex flex-wrap gap-3">
        <a href="/" target="_blank" rel="noopener" className="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent">Open the website ↗</a>
        <Button variant="ghost" disabled={a.busy} onClick={() => a.run(async () => { const r = await api<{ people: number; projects: number }>("/api/site/resync", "POST"); return r; }, "Website rebuilt from your records")}>Rebuild website data</Button>
      </div>
      <p className="mt-3 text-xs text-muted">The website updates automatically. Use “Rebuild” after a restore or if something looks out of date.</p>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
    </Card>
  );
}
