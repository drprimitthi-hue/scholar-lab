"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useScholars } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { todayInTz } from "@/lib/domain/dates";
import type { ProjectDoc } from "@/lib/types";
import { Button, ErrorText, Field, Input, Select, Textarea, useAction } from "./ui";

type F = Pick<ProjectDoc, "title" | "objectives" | "status" | "startDate" | "endDate" | "scholarUids" | "releaseMode" | "gateThreshold" | "minWords" | "cardsVisibleToGroup"> & { publicVisible: boolean; publicSummary: string };

export function ProjectForm({ project, onDone }: { project?: ProjectDoc; onDone: (id?: string) => void }) {
  const s = useSession();
  const scholars = useScholars();
  const [f, setF] = useState<F>(
    project ? { ...project, publicVisible: project.publicVisible ?? false, publicSummary: project.publicSummary ?? "" } : {
      publicVisible: false, publicSummary: "",
      title: "", objectives: "", status: "active", startDate: todayInTz(s.settings.timezone), endDate: "", scholarUids: [],
      releaseMode: "both", gateThreshold: 0.8, minWords: 15, cardsVisibleToGroup: false,
    },
  );
  const a = useAction();
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: F = {
      title: f.title, objectives: f.objectives, status: f.status, startDate: f.startDate, endDate: f.endDate, scholarUids: f.scholarUids,
      releaseMode: f.releaseMode, gateThreshold: f.gateThreshold, minWords: f.minWords, cardsVisibleToGroup: f.cardsVisibleToGroup,
      publicVisible: f.publicVisible, publicSummary: f.publicSummary,
    };
    let id: string | undefined;
    const ok = await a.run(async () => {
      if (project) await api(`/api/projects/${project.id}`, "PATCH", body);
      else id = (await api<{ id: string }>("/api/projects", "POST", body)).id;
    });
    if (ok) onDone(id);
  }
  const active = scholars.data.filter((x) => !x.deletion).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Title"><Input required minLength={3} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <Field label="Objectives / route summary"><Textarea rows={3} value={f.objectives} onChange={(e) => set("objectives", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value as F["status"])}>{["planned", "active", "on_hold", "completed", "closed"].map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</Select></Field>
        <Field label="Start"><Input type="date" required value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
        <Field label="End (optional)"><Input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
      </div>
      <Field label="Scholars on this project">
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {active.map((x) => (
            <label key={x.uid} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.scholarUids.includes(x.uid)} onChange={(e) => set("scholarUids", e.target.checked ? [...f.scholarUids, x.uid] : f.scholarUids.filter((u) => u !== x.uid))} />
              {x.name}
            </label>
          ))}
          {!active.length && <p className="text-xs text-muted">Add scholars first.</p>}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Release batches" hint="Date: on its day. Gated: after the previous is done. Both: both conditions.">
          <Select value={f.releaseMode} onChange={(e) => set("releaseMode", e.target.value as F["releaseMode"])}><option value="both">Date + completion</option><option value="date">By date</option><option value="gated">By completion</option></Select>
        </Field>
        <Field label="Completion gate (%)"><Input type="number" min={50} max={100} value={Math.round(f.gateThreshold * 100)} onChange={(e) => set("gateThreshold", Number(e.target.value) / 100)} /></Field>
        <Field label="Min words per card field"><Input type="number" min={0} max={200} value={f.minWords} onChange={(e) => set("minWords", Number(e.target.value))} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.cardsVisibleToGroup} onChange={(e) => set("cardsVisibleToGroup", e.target.checked)} />Let scholars of this project see each other&apos;s <b>accepted</b> Reading Cards and Concept Notes</label>
      <div className="rounded-xl border border-line p-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.publicVisible} onChange={(e) => set("publicVisible", e.target.checked)} />Show this project on the public lab website</label>
        {f.publicVisible && <div className="mt-2"><Field label="Public summary (only this text is published; team names appear only for scholars who agreed)"><Textarea rows={3} value={f.publicSummary} onChange={(e) => set("publicSummary", e.target.value)} /></Field></div>}
      </div>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Saving…" : project ? "Save" : "Create project"}</Button>
    </form>
  );
}
