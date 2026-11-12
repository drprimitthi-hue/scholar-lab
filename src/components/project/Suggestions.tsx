"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSuggestions } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import type { ProjectDoc, Suggestion } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Notice, Select, Spinner, Textarea, useAction } from "../ui";

function Decide({ project, sug }: { project: ProjectDoc; sug: Suggestion }) {
  const [f, setF] = useState({ type: "primary", priority: "supporting", theme: "", estMinutes: 30 });
  const a = useAction();
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <Select className="w-32 py-1 text-xs" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["review", "primary", "patent", "standard", "datasheet", "tutorial", "other"].map((t) => <option key={t}>{t}</option>)}</Select>
      <Select className="w-32 py-1 text-xs" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{["core", "supporting", "optional"].map((t) => <option key={t}>{t}</option>)}</Select>
      <Input className="w-36 py-1 text-xs" placeholder="Theme" value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} />
      <Input className="w-20 py-1 text-xs" type="number" min={1} value={f.estMinutes} onChange={(e) => setF({ ...f, estMinutes: Number(e.target.value) })} />
      <Button variant="soft" className="py-1" disabled={a.busy} onClick={() => a.run(() => api(`/api/projects/${project.id}/suggestions/${sug.id}`, "PATCH", { action: "approve", ...f, theme: f.theme || undefined }))}>Add to list</Button>
      <Button variant="ghost" className="py-1" disabled={a.busy} onClick={() => a.run(() => api(`/api/projects/${project.id}/suggestions/${sug.id}`, "PATCH", { action: "reject" }))}>Decline</Button>
      <ErrorText>{a.error}</ErrorText>
    </div>
  );
}

export function Suggestions({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const { data, loading, error } = useSuggestions(project.id);
  const [f, setF] = useState({ title: "", url: "", reason: "" });
  const a = useAction();
  if (loading) return <Spinner />;
  const list = [...data].sort((x, y) => y.createdAt - x.createdAt);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {s.role === "scholar" && (
        <Card title="Suggest a paper">
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api(`/api/projects/${project.id}/suggestions`, "POST", f), "Sent to your supervisor")) setF({ title: "", url: "", reason: "" }); }}>
            <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Link (https://…)"><Input required type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
            <Field label="Why it matters"><Textarea required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
            <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
            <Button type="submit" disabled={a.busy}>Suggest</Button>
          </form>
        </Card>
      )}
      <Card title="Suggested papers" className={s.role === "scholar" ? "" : "lg:col-span-2"}>
        <ErrorText>{error}</ErrorText>
        {!list.length ? <Empty>No suggestions.</Empty> : (
          <ul className="divide-y divide-line/60">
            {list.map((x) => (
              <li key={x.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div><a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:text-accent">{x.title}</a>
                    <p className="text-muted">{x.reason}</p><p className="text-xs text-muted">{x.scholarName} · {new Date(x.createdAt).toLocaleDateString("en-GB")}</p></div>
                  <Badge tone={x.status === "approved" ? "ok" : x.status === "rejected" ? "neutral" : "warn"}>{x.status}</Badge>
                </div>
                {s.role === "supervisor" && x.status === "pending" && <Decide project={project} sug={x} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
