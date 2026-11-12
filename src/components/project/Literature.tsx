"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { useLiterature } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { rowsFromCsv, readingOrder, type ImportRow } from "@/lib/domain/literature";
import { toCsv } from "@/lib/domain/csv";
import type { ProjectDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Input, Modal, Notice, Select, Spinner, useAction } from "../ui";

export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TEMPLATE = toCsv(
  ["id", "title", "authors", "year", "venue", "url", "type", "priority", "theme", "est_minutes", "order_hint"],
  [["L001", "Example: A survey of physical unclonable functions", "A. Author; B. Author", "2021", "IEEE Access", "https://doi.org/10.xxxx/xxxxx", "review", "core", "PUF basics", "45", "1"]],
);

function Import({ project, onClose }: { project: ProjectDoc; onClose: () => void }) {
  const [parsed, setParsed] = useState<{ items: ImportRow[]; errors: string[] } | null>(null);
  const a = useAction();
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted">Columns: <code>id, title, authors, year, venue, url, type, priority, theme, est_minutes, order_hint</code>. Only <b>title</b> and <b>url</b> are required. Links only — no PDFs are stored.</p>
      <p className="text-xs text-muted">type: review / primary / patent / standard / datasheet / tutorial · priority: core / supporting / optional</p>
      <Button variant="ghost" onClick={() => download("literature-template.csv", TEMPLATE)}>Download template</Button>
      <Input type="file" accept=".csv,text/csv" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 3 * 1024 * 1024) return setParsed({ items: [], errors: ["File larger than 3 MB"] });
        try { setParsed(rowsFromCsv(await f.text())); } catch (err) { setParsed({ items: [], errors: [(err as Error).message] }); }
      }} />
      {parsed && (
        <div className="space-y-2">
          <p><b>{parsed.items.length}</b> papers ready to import{parsed.errors.length ? `, ${parsed.errors.length} rows skipped:` : "."}</p>
          {parsed.errors.length > 0 && <ul className="max-h-32 overflow-y-auto rounded bg-red-50 p-2 text-xs text-bad">{parsed.errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul>}
          <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
          <Button disabled={!parsed.items.length || a.busy} onClick={async () => {
            let msg = "";
            if (await a.run(async () => { const r = await api<{ added: number; skipped: number }>(`/api/projects/${project.id}/literature`, "POST", { items: parsed.items }); msg = `${r.added} added, ${r.skipped} already in the list`; })) { alert(msg + ". Re-plan the scholars' schedules on the Plans tab to include new papers."); onClose(); }
          }}>{a.busy ? "Importing…" : "Import"}</Button>
        </div>
      )}
    </div>
  );
}

export function Literature({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const { data, loading, error } = useLiterature(project.id);
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("");
  const [open, setOpen] = useState(false);
  const a = useAction();
  const ordered = useMemo(() => readingOrder(data), [data]);
  const themes = [...new Set(ordered.map((i) => i.theme))];
  const list = ordered.filter((i) => (!theme || i.theme === theme) && (!q || `${i.title} ${i.authors} ${i.venue}`.toLowerCase().includes(q.toLowerCase())));
  if (loading) return <Spinner />;
  return (
    <Card title={`Literature · ${data.length} papers`} action={<div className="flex gap-2">
      <Button variant="ghost" onClick={() => download(`${project.title}-literature.csv`, toCsv(["id", "title", "authors", "year", "venue", "url", "type", "priority", "theme", "est_minutes"], ordered.map((i) => [i.id, i.title, i.authors, i.year, i.venue, i.url, i.type, i.priority, i.theme, i.estMinutes])))}>Export CSV</Button>
      {s.role === "supervisor" && <Button onClick={() => setOpen(true)}>Upload CSV</Button>}
    </div>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search title, authors, venue…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="">All themes</option>{themes.map((t) => <option key={t}>{t}</option>)}</Select>
      </div>
      <ErrorText>{error || a.error}</ErrorText>
      {!list.length ? <Empty>No papers yet. Upload a CSV to start.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">#</th><th className="pr-3">Paper</th><th className="pr-3">Theme</th><th className="pr-3">Type</th><th className="pr-3">Min</th><th></th></tr></thead>
            <tbody>
              {list.map((i, n) => (
                <tr key={i.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-2 pr-3 text-muted">{n + 1}</td>
                  <td className="py-2 pr-3"><a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:text-accent">{i.title}</a>
                    <div className="text-xs text-muted">{[i.authors, i.venue, i.year].filter(Boolean).join(" · ")}</div></td>
                  <td className="pr-3">{i.theme}</td>
                  <td className="pr-3"><Badge tone={i.type === "review" ? "accent" : "neutral"}>{i.type}</Badge> <Badge tone={i.priority === "core" ? "warn" : "neutral"}>{i.priority}</Badge></td>
                  <td className="pr-3 text-muted">{i.estMinutes}</td>
                  <td className="text-right">{s.role === "supervisor" && <button className="text-xs text-muted hover:text-bad" onClick={() => confirm(`Remove "${i.title}"?`) && a.run(() => api(`/api/projects/${project.id}/literature/${i.id}`, "DELETE"))}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload literature CSV">{open && <Import project={project} onClose={() => setOpen(false)} />}</Modal>
    </Card>
  );
}
