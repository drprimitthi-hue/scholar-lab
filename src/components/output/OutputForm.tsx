"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useProjects, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { KIND_LABEL, TRL_LABEL } from "@/lib/domain/outputs";
import type { OutputDoc, OutputKind } from "@/lib/types";
import { Button, ErrorText, Field, Input, Select, Textarea, useAction } from "@/components/ui";

const SUBTYPES: Partial<Record<OutputKind, { label: string; options?: string[] }>> = {
  publication: { label: "Type", options: ["journal", "conference", "book", "chapter", "other"] },
  patent: { label: "Patent office / country" },
  product: { label: "Category (e.g. device, kit)" },
  software: { label: "Licence (e.g. MIT, proprietary)" },
  dataset: { label: "Access (open / on request)" },
  thesis_chapter: { label: "Chapter number" },
};
const VENUE: Record<OutputKind, string> = {
  publication: "Journal / conference / publisher", patent: "Applicant", product: "Partner / where deployed",
  software: "Repository or platform", dataset: "Repository", thesis_chapter: "Thesis title",
};
const IDENT: Record<OutputKind, string> = {
  publication: "DOI / ISBN", patent: "Application / patent number", product: "Model / version", software: "Version", dataset: "DOI / accession", thesis_chapter: "",
};

export function OutputForm({ output, onDone }: { output?: OutputDoc; onDone: (id?: string) => void }) {
  const ss = useSession();
  const scholars = useScholars();
  const projects = useProjects();
  const me = ss.user?.uid ?? "";
  const [kind, setKind] = useState<OutputKind>(output?.kind ?? "publication");
  const [f, setF] = useState({
    subtype: output?.subtype ?? "journal", title: output?.title ?? "", authors: output?.authors ?? "",
    memberUids: output?.memberUids ?? (ss.role === "scholar" ? [me] : []), projectId: output?.projectId ?? "",
    venue: output?.venue ?? "", year: output?.year ?? "", identifier: output?.identifier ?? "", url: output?.url ?? "",
    date: output?.date ?? "", trl: output?.trl ?? 0, notes: output?.notes ?? "", publicSummary: output?.publicSummary ?? "",
  });
  const a = useAction();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const sub = SUBTYPES[kind];
  const sup = ss.role === "supervisor";
  const pickable = scholars.data.filter((x) => !x.deletion).sort((x, y) => x.name.localeCompare(y.name));
  const save = () => a.run(async () => {
    // Members this user cannot see (e.g. another mentor's mentee) are always kept.
    const hidden = (output?.memberUids ?? []).filter((u) => !pickable.some((x) => x.uid === u));
    const { trl, ...rest } = { ...f, trl: Number(f.trl), memberUids: [...new Set([...f.memberUids, ...hidden])] };
    const body = sup ? { ...rest, trl } : rest;
    if (output) {
      await api(`/api/outputs/${output.id}`, "PATCH", body);
      onDone(output.id);
    } else {
      const r = await api<{ id: string }>("/api/outputs", "POST", { kind, ...rest, trl: sup ? trl : 0 });
      onDone(r.id);
    }
  });
  return (
    <div className="space-y-3">
      {!output && <Field label="What is it?"><Select value={kind} onChange={(e) => { const k = e.target.value as OutputKind; setKind(k); setF({ ...f, subtype: k === "publication" ? "journal" : "" }); }}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>}
      <Field label="Title"><Input value={f.title} onChange={set("title")} /></Field>
      {kind !== "thesis_chapter" && <Field label="Authors / inventors / team" hint="As it should be printed, including outside co-authors"><Input value={f.authors} onChange={set("authors")} /></Field>}
      {sub && <Field label={sub.label}>{sub.options ? <Select value={f.subtype} onChange={set("subtype")}>{sub.options.map((o) => <option key={o} value={o}>{o}</option>)}</Select> : <Input value={f.subtype} onChange={set("subtype")} />}</Field>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={VENUE[kind]}><Input value={f.venue} onChange={set("venue")} /></Field>
        <Field label="Year"><Input value={f.year} placeholder="2026" onChange={set("year")} /></Field>
        {IDENT[kind] && <Field label={IDENT[kind]}><Input value={f.identifier} onChange={set("identifier")} /></Field>}
        <Field label="Link"><Input value={f.url} placeholder="https://…" onChange={set("url")} /></Field>
        <Field label="Project"><Select value={f.projectId} onChange={set("projectId")}><option value="">— none —</option>{projects.data.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
        {(kind === "product" || kind === "software") && sup && <Field label="Technology readiness level"><Select value={f.trl} onChange={set("trl")}>{TRL_LABEL.map((l, i) => <option key={i} value={i}>{i ? `TRL ${i} — ${l}` : "Not set"}</option>)}</Select></Field>}
      </div>
      <Field label="Lab members" hint={ss.role === "scholar" ? "The supervisor can add other lab members." : undefined}>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2 text-sm">
          {pickable.map((x) => (
            <label key={x.uid} className="flex items-center gap-2">
              <input type="checkbox" checked={f.memberUids.includes(x.uid)} disabled={ss.role === "scholar" && x.uid === me}
                onChange={(e) => setF({ ...f, memberUids: e.target.checked ? [...f.memberUids, x.uid] : f.memberUids.filter((u) => u !== x.uid) })} />{x.name}
            </label>
          ))}
          {output && output.memberUids.filter((u) => !pickable.some((x) => x.uid === u)).map((u) => <p key={u} className="text-xs text-muted">+ {output.memberNames[output.memberUids.indexOf(u)]}</p>)}
        </div>
      </Field>
      <Field label="Notes (private)"><Textarea value={f.notes} onChange={set("notes")} /></Field>
      {sup && <Field label="Short public summary" hint="Shown on the website if you make it public"><Textarea rows={2} value={f.publicSummary} onChange={set("publicSummary")} /></Field>}
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.title.trim().length < 3} onClick={save}>{output ? "Save" : "Register"}</Button>
    </div>
  );
}
