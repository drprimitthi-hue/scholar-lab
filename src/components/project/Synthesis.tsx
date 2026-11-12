"use client";
import { useMemo, useState } from "react";
import { useCards, useLiterature } from "@/lib/client/data";
import { toCsv } from "@/lib/domain/csv";
import type { ProjectDoc } from "@/lib/types";
import { Button, Card, Empty, Input, Spinner, Tabs } from "../ui";
import { download } from "./Literature";

export function Synthesis({ project }: { project: ProjectDoc }) {
  const cards = useCards({ projectId: project.id, status: "accepted" });
  const lit = useLiterature(project.id);
  const [view, setView] = useState("matrix");
  const [q, setQ] = useState("");
  const items = useMemo(() => new Map(lit.data.map((i) => [i.id, i])), [lit.data]);
  if (cards.loading) return <Spinner />;
  const list = cards.data
    .filter((c) => !q || JSON.stringify(c).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (items.get(a.itemId)?.theme ?? "").localeCompare(items.get(b.itemId)?.theme ?? "") || a.itemTitle.localeCompare(b.itemTitle));

  const exportCsv = () =>
    download(`${project.title}-synthesis-matrix.csv`, toCsv(
      ["Theme", "Paper", "Year", "Venue", "Link", "Scholar", "Problem", "Method", "Setup", "Key result", "Limitations", "Concepts", "Relevance", "Citable claim"],
      list.map((c) => { const i = items.get(c.itemId); return [i?.theme, c.itemTitle, i?.year, i?.venue, i?.url, c.scholarName, c.problem, c.method, c.setup, c.keyResult, c.limitations, c.concepts, c.relevance, c.citableClaim]; }),
    ));

  return (
    <Card title={`Synthesis · ${cards.data.length} accepted cards`} action={<Button variant="ghost" disabled={!list.length} onClick={exportCsv}>Export to Excel (CSV)</Button>}>
      <Tabs tabs={[{ id: "matrix", label: "Synthesis matrix" }, { id: "gaps", label: "Gap register" }, { id: "concepts", label: "Concept index" }]} value={view} onChange={setView} />
      <Input className="mb-4" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length ? <Empty>Accepted Reading Cards appear here.</Empty> : view === "matrix" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead><tr className="border-b border-line text-left uppercase tracking-wide text-muted">{["Paper", "Problem", "Method", "Key result", "Limitations", "Rel."].map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="w-56 py-2 pr-3"><span className="font-medium">{c.itemTitle}</span><div className="text-muted">{items.get(c.itemId)?.theme} · {c.scholarName}</div></td>
                  <td className="pr-3">{c.problem}</td><td className="pr-3">{c.method}</td><td className="pr-3">{c.keyResult}</td><td className="pr-3">{c.limitations}</td><td>{c.relevance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "gaps" ? (
        <div className="space-y-5">
          {[...new Set(list.map((c) => items.get(c.itemId)?.theme ?? "General"))].map((t) => (
            <div key={t}>
              <h3 className="mb-2 text-sm font-semibold">{t}</h3>
              <ul className="space-y-2 text-sm">
                {list.filter((c) => (items.get(c.itemId)?.theme ?? "General") === t).map((c) => (
                  <li key={c.id} className="rounded-lg bg-canvas p-3"><p>{c.limitations}</p><p className="mt-1 text-xs text-muted">— {c.itemTitle}</p></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Object.entries(list.flatMap((c) => c.concepts ?? []).map((k) => k.trim()).filter(Boolean).reduce<Record<string, number>>((m, k) => ({ ...m, [k.toLowerCase()]: (m[k.toLowerCase()] ?? 0) + 1 }), {}))
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => <span key={k} className="rounded-full border border-line bg-white px-3 py-1 text-sm">{k} <span className="text-muted">×{n}</span></span>)}
        </div>
      )}
    </Card>
  );
}
