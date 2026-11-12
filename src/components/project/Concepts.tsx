"use client";
import { useMemo, useState } from "react";
import { api, openFile, uploadFile } from "@/lib/client/api";
import { useConceptNotes, useConcepts, useGroupNotes, useLiterature, useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { MASTERY, masteryRank, prerequisitesMet } from "@/lib/domain/concepts";
import { wordCount } from "@/lib/domain/literature";
import type { Concept, ConceptNote, ConceptNoteFields, Mastery, ProjectDoc } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Notice, Select, Spinner, Textarea, useAction } from "../ui";
import { ConceptMap, MASTERY_STYLE } from "../ConceptMap";

const noteTone = (st?: ConceptNote["status"]) => (st === "accepted" ? "ok" : st === "submitted" ? "accent" : st === "revise" ? "warn" : "neutral");

function ConceptForm({ project, concept, concepts, onDone }: { project: ProjectDoc; concept: Concept | null; concepts: Concept[]; onDone: () => void }) {
  const lit = useLiterature(project.id);
  const [f, setF] = useState({ title: concept?.title ?? "", description: concept?.description ?? "", prerequisites: concept?.prerequisites ?? [], itemIds: concept?.itemIds ?? [] });
  const [q, setQ] = useState("");
  const a = useAction();
  const others = concepts.filter((c) => c.id !== concept?.id);
  const papers = lit.data.filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => (concept ? api(`/api/projects/${project.id}/concepts/${concept.id}`, "PATCH", f) : api(`/api/projects/${project.id}/concepts`, "POST", f)))) onDone(); }}>
      <Field label="Concept"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="What should the scholar learn?"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Prerequisites (must be explained first)">
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {!others.length && <p className="text-xs text-muted">No other concepts yet.</p>}
          {others.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.prerequisites.includes(c.id)} onChange={(e) => setF({ ...f, prerequisites: e.target.checked ? [...f.prerequisites, c.id] : f.prerequisites.filter((x) => x !== c.id) })} />{c.title}</label>)}
        </div>
      </Field>
      <Field label={`Related papers (${f.itemIds.length})`}>
        <Input placeholder="Search the project's literature…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {papers.map((i) => <label key={i.id} className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={f.itemIds.includes(i.id)} onChange={(e) => setF({ ...f, itemIds: e.target.checked ? [...f.itemIds, i.id] : f.itemIds.filter((x) => x !== i.id) })} />{i.title}</label>)}
        </div>
      </Field>
      <ErrorText>{a.error}</ErrorText>
      <div className="flex justify-between">
        <Button type="submit" disabled={a.busy}>Save</Button>
        {concept && <Button type="button" variant="ghost" className="text-bad" onClick={async () => { if (confirm("Delete this concept?") && (await a.run(() => api(`/api/projects/${project.id}/concepts/${concept.id}`, "DELETE")))) onDone(); }}>Delete</Button>}
      </div>
    </form>
  );
}

function NoteForm({ project, note, concept, onDone }: { project: ProjectDoc; note: ConceptNote; concept: Concept; onDone: () => void }) {
  const lit = useLiterature(project.id);
  const s = useSession();
  const [f, setF] = useState<ConceptNoteFields & { figures: { path: string; name: string }[] }>({
    definition: note.definition ?? "", explanation: note.explanation ?? "", equations: note.equations ?? "", example: note.example ?? "", usedIn: note.usedIn ?? "",
    paperIds: note.paperIds ?? concept.itemIds, figures: note.figures ?? [],
  });
  const [files, setFiles] = useState<File[]>([]);
  const a = useAction();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const ready = wordCount(f.definition) >= 5 && wordCount(f.explanation) >= 30;
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await a.run(async () => {
        const figures = [...f.figures];
        for (const file of files) figures.push({ path: await uploadFile(s.user!.uid, file), name: file.name.slice(0, 200) });
        await api(`/api/concept-notes/${note.id}`, "PUT", { ...f, figures: figures.slice(0, 6) });
      });
      if (ok) onDone();
    }}>
      {note.status === "revise" && note.reviewComment && <p className="rounded-lg bg-amber-50 p-3 text-sm text-warn"><b>Revise:</b> {note.reviewComment}</p>}
      <Field label={`Definition · ${wordCount(f.definition)}/5 words`}><Textarea rows={2} value={f.definition} onChange={(e) => set("definition", e.target.value)} /></Field>
      <Field label={`Explanation in your own words · ${wordCount(f.explanation)}/30 words`}><Textarea rows={5} value={f.explanation} onChange={(e) => set("explanation", e.target.value)} /></Field>
      <Field label="Key equations / notation (optional)"><Textarea rows={2} className="font-mono" value={f.equations} onChange={(e) => set("equations", e.target.value)} /></Field>
      <Field label="Worked example (optional)"><Textarea rows={3} value={f.example} onChange={(e) => set("example", e.target.value)} /></Field>
      <Field label="Where it is used in our prototype (optional)"><Textarea rows={2} value={f.usedIn} onChange={(e) => set("usedIn", e.target.value)} /></Field>
      <Field label="Papers this note draws on">
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {lit.data.filter((i) => concept.itemIds.includes(i.id) || f.paperIds.includes(i.id)).concat(lit.data.filter((i) => !concept.itemIds.includes(i.id) && !f.paperIds.includes(i.id)).slice(0, 15)).map((i) => (
            <label key={i.id} className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={f.paperIds.includes(i.id)} onChange={(e) => set("paperIds", e.target.checked ? [...f.paperIds, i.id] : f.paperIds.filter((x) => x !== i.id))} />{i.title}</label>
          ))}
        </div>
      </Field>
      <Field label="Diagrams or derivations (PNG/JPEG/PDF, up to 6)">
        {f.figures.map((fig) => <p key={fig.path} className="text-xs">📎 {fig.name} <button type="button" className="text-bad" onClick={() => set("figures", f.figures.filter((x) => x.path !== fig.path))}>remove</button></p>)}
        <Input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6 - f.figures.length))} />
      </Field>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy || !ready}>{a.busy ? "Submitting…" : "Submit for review"}</Button>
    </form>
  );
}

export function NoteView({ n, titles }: { n: ConceptNote; titles?: Map<string, string> }) {
  const row = (label: string, v?: string, mono = false) => (v ? <div><dt className="text-xs font-medium text-muted">{label}</dt><dd className={`whitespace-pre-wrap text-sm ${mono ? "font-mono" : ""}`}>{v}</dd></div> : null);
  return (
    <dl className="space-y-2">
      {row("Definition", n.definition)}{row("Explanation", n.explanation)}{row("Equations", n.equations, true)}{row("Example", n.example)}{row("Used in prototype", n.usedIn)}
      {n.paperIds?.length ? <div><dt className="text-xs font-medium text-muted">Papers</dt><dd className="text-xs">{n.paperIds.map((p) => titles?.get(p) ?? p).join(" · ")}</dd></div> : null}
      {n.figures?.length ? <div className="flex flex-wrap gap-2">{n.figures.map((f) => <button key={f.path} className="text-xs text-accent hover:underline" onClick={() => openFile(f.path).catch((e: Error) => alert(e.message))}>📎 {f.name}</button>)}</div> : null}
    </dl>
  );
}

export function Concepts({ project }: { project: ProjectDoc }) {
  const s = useSession();
  const concepts = useConcepts(project.id);
  const notes = useConceptNotes({ projectId: project.id });
  const group = useGroupNotes(project.id, project.cardsVisibleToGroup);
  const lit = useLiterature(project.id);
  const scholars = useScholars();
  const [sel, setSel] = useState<string | null>(null);
  const [who, setWho] = useState<string>("cohort");
  const [edit, setEdit] = useState<Concept | "new" | null>(null);
  const [writing, setWriting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const a = useAction();
  const titles = useMemo(() => new Map(lit.data.map((i) => [i.id, i.title])), [lit.data]);
  if (concepts.loading || notes.loading) return <Spinner />;

  const me = s.user?.uid ?? "";
  const isScholar = s.role === "scholar";
  const members = scholars.data.filter((x) => project.scholarUids.includes(x.uid));
  const notesOf = (uid: string) => new Map(notes.data.filter((n) => n.uid === uid).map((n) => [n.conceptId, n]));
  const target = isScholar ? me : who;
  const mine = notesOf(target);
  const masteryMap = new Map([...mine.entries()].map(([k, n]) => [k, n.mastery]));
  const cohortCaption = (cid: string) => {
    const done = members.filter((m) => masteryRank(notes.data.find((n) => n.uid === m.uid && n.conceptId === cid)?.mastery) >= 2).length;
    return `${done}/${members.length} explained`;
  };
  const cohortMastery = (cid: string): Mastery | "none" => {
    const ranks = members.map((m) => masteryRank(notes.data.find((n) => n.uid === m.uid && n.conceptId === cid)?.mastery));
    if (!ranks.length) return "none";
    const min = Math.min(...ranks);
    return min === 0 ? "none" : MASTERY[min - 1]!;
  };
  const selected = concepts.data.find((c) => c.id === sel) ?? null;
  const selNote = selected ? mine.get(selected.id) : undefined;
  const locked = (cid: string) => {
    const c = concepts.data.find((x) => x.id === cid)!;
    return target !== "cohort" && !mine.has(cid) && !prerequisitesMet(c, masteryMap);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Concept map" className="lg:col-span-2" action={
        <div className="flex gap-2">
          {!isScholar && <Select className="w-48 py-1" value={who} onChange={(e) => setWho(e.target.value)}><option value="cohort">Whole group</option>{members.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}</Select>}
          {s.role === "supervisor" && <Button variant="ghost" onClick={() => setEdit("new")}>Add concept</Button>}
        </div>}>
        <ConceptMap concepts={concepts.data} selected={sel} onSelect={setSel}
          mastery={(cid) => (target === "cohort" ? cohortMastery(cid) : mine.get(cid)?.mastery ?? "none")}
          locked={target === "cohort" ? undefined : locked}
          caption={target === "cohort" ? cohortCaption : (cid) => (mine.get(cid) ? `note: ${mine.get(cid)!.status}` : "")} />
        <p className="mt-2 text-xs text-muted">{target === "cohort" ? "Colour = the lowest level reached by anyone in the group. Click a concept for details." : "Click a concept for details."}</p>
      </Card>

      <Card title={selected ? selected.title : "Details"}>
        {!selected ? <Empty>Select a concept on the map.</Empty> : (
          <div className="space-y-4 text-sm">
            {selected.description && <p className="whitespace-pre-wrap">{selected.description}</p>}
            {selected.prerequisites.length > 0 && <p className="text-xs text-muted">Needs: {selected.prerequisites.map((p) => concepts.data.find((c) => c.id === p)?.title).join(", ")}</p>}
            {selected.itemIds.length > 0 && <div><p className="text-xs font-medium text-muted">Related papers</p><ul className="mt-1 space-y-1 text-xs">{selected.itemIds.map((i) => <li key={i}>{titles.get(i) ?? i}</li>)}</ul></div>}
            <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>

            {isScholar && (
              !selNote ? (
                locked(selected.id) ? <Badge>Locked — explain the prerequisites first</Badge>
                  : <Button disabled={a.busy} onClick={() => a.run(() => api("/api/concept-notes/claim", "POST", { projectId: project.id, conceptId: selected.id }))}>Take up this concept</Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2"><Badge tone={noteTone(selNote.status)}>{selNote.status}</Badge><Badge tone="accent">{MASTERY_STYLE[selNote.mastery].label}</Badge></div>
                  {(selNote.status === "claimed" || selNote.status === "revise") && <Button onClick={() => setWriting(true)}>{selNote.status === "revise" ? "Revise note" : "Write concept note"}</Button>}
                  {(selNote.status === "submitted" || selNote.status === "accepted") && <NoteView n={selNote} titles={titles} />}
                </div>
              )
            )}

            {!isScholar && (
              <div className="space-y-3">
                {s.role === "supervisor" && <div className="flex gap-2"><Button variant="ghost" onClick={() => setEdit(selected)}>Edit</Button><Button variant="soft" onClick={() => setAssigning(true)}>Assign to scholars</Button></div>}
                <ul className="divide-y divide-line/60">
                  {members.map((m) => {
                    const n = notes.data.find((x) => x.uid === m.uid && x.conceptId === selected.id);
                    return (
                      <li key={m.uid} className="py-2">
                        <div className="flex items-center justify-between gap-2"><span>{m.name}</span>{n ? <span className="flex gap-1"><Badge tone={noteTone(n.status)}>{n.status}</Badge><Badge tone="accent">{MASTERY_STYLE[n.mastery].label}</Badge></span> : <Badge>not started</Badge>}</div>
                        {n?.status === "accepted" && masteryRank(n.mastery) < 3 && <button className="mt-1 text-xs text-accent hover:underline" onClick={() => a.run(() => api(`/api/concept-notes/${n.id}/review`, "POST", { action: "applied", comment: "" }), "Marked as applied")}>Mark as applied in prototype</button>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {isScholar && project.cardsVisibleToGroup && group.data.filter((g) => g.conceptId === selected.id && g.uid !== me).map((g) => (
              <details key={g.id} className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-xs font-medium">{g.scholarName}&apos;s note</summary><div className="mt-2"><NoteView n={g} titles={titles} /></div></details>
            ))}
          </div>
        )}
      </Card>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Add concept" : "Edit concept"}>
        {edit !== null && <ConceptForm project={project} concept={edit === "new" ? null : edit} concepts={concepts.data} onDone={() => setEdit(null)} />}
      </Modal>
      <Modal open={writing && !!selected && !!selNote} onClose={() => setWriting(false)} title={selected?.title ?? ""}>
        {writing && selected && selNote && <NoteForm project={project} note={selNote} concept={selected} onDone={() => setWriting(false)} />}
      </Modal>
      <Modal open={assigning && !!selected} onClose={() => setAssigning(false)} title={`Assign: ${selected?.title ?? ""}`}>
        {assigning && selected && <Assign project={project} concept={selected} members={members.map((m) => ({ uid: m.uid, name: m.name }))} onDone={() => setAssigning(false)} />}
      </Modal>
    </div>
  );
}

function Assign({ project, concept, members, onDone }: { project: ProjectDoc; concept: Concept; members: { uid: string; name: string }[]; onDone: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const a = useAction();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Assigned scholars start at “Heard” and can write their note straight away (prerequisites are not enforced for assignments).</p>
      {members.map((m) => <label key={m.uid} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.includes(m.uid)} onChange={(e) => setSel(e.target.checked ? [...sel, m.uid] : sel.filter((x) => x !== m.uid))} />{m.name}</label>)}
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={!sel.length || a.busy} onClick={async () => { if (await a.run(() => api(`/api/projects/${project.id}/concepts/${concept.id}/assign`, "POST", { uids: sel }))) onDone(); }}>Assign</Button>
    </div>
  );
}
