"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useOfficeSettings } from "@/lib/client/office";
import { useSession } from "@/lib/client/session";
import { todayInTz } from "@/lib/domain/dates";
import type { DutyDoc, MeetingDoc, OrderDoc, RecordDoc } from "@/lib/types";
import { Button, ErrorText, Field, Input, Select, Textarea, useAction } from "@/components/ui";
import { FileField, ListInput, MultiSelect } from "./bits";

type Body<T> = Omit<T, "id" | "createdAt" | "updatedAt">;
function useSave<T>(kind: string, id: string | undefined, onDone: (id: string) => void) {
  const a = useAction();
  const save = (body: Body<T>) => a.run(async () => {
    const r = await api<{ id?: string }>(id ? `/api/office/${kind}/${id}` : `/api/office/${kind}`, id ? "PUT" : "POST", body);
    onDone(id ?? r.id ?? "");
  });
  return { a, save };
}
const strip = <T extends { id: string; createdAt: number; updatedAt: number }>(x: T): Body<T> => { const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = x; void _i; void _c; void _u; return rest as Body<T>; };

export function MeetingForm({ m, onDone }: { m?: MeetingDoc; onDone: (id: string) => void }) {
  const ss = useSession();
  const os = useOfficeSettings();
  const [f, setF] = useState<Body<MeetingDoc>>(m ? strip(m) : { date: todayInTz(ss.settings.timezone), time: "", title: "", type: "", chair: "", venue: "", attendees: "", agenda: "", keyPoints: "", decisions: "", files: [] });
  const { a, save } = useSave<MeetingDoc>("meetings", m?.id, onDone);
  const set = (k: keyof Body<MeetingDoc>) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <Field label="Title / committee"><Input value={f.title} onChange={set("title")} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date"><Input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="Time"><Input type="time" value={f.time} onChange={set("time")} /></Field>
        <Field label="Type"><ListInput options={os.meetingTypes} value={f.type} onChange={(v) => setF({ ...f, type: v })} placeholder="Type" /></Field>
        <Field label="Venue"><Input value={f.venue} onChange={set("venue")} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chair"><Input value={f.chair} onChange={set("chair")} /></Field>
        <Field label="Attendees"><Input value={f.attendees} onChange={set("attendees")} /></Field>
      </div>
      <Field label="Agenda"><Textarea rows={2} value={f.agenda} onChange={set("agenda")} /></Field>
      <Field label="Key points" hint="One per line"><Textarea rows={5} value={f.keyPoints} onChange={set("keyPoints")} /></Field>
      <Field label="Decisions"><Textarea rows={2} value={f.decisions} onChange={set("decisions")} /></Field>
      <Field label="Minutes / documents (PDF or image)"><FileField value={f.files} onChange={(files) => setF({ ...f, files })} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.title.trim().length < 2} onClick={() => save(f)}>{m ? "Save" : "Record meeting"}</Button>
    </div>
  );
}

export function DutyForm({ d, source, onDone }: { d?: DutyDoc; source?: DutyDoc["source"]; onDone: (id: string) => void }) {
  const ss = useSession();
  const os = useOfficeSettings();
  const [f, setF] = useState<Body<DutyDoc>>(d ? strip(d) : {
    title: "", details: "", assignedBy: "", assignedOn: todayInTz(ss.settings.timezone), deadline: "", remindDays: os.reminderDays,
    status: "open", doneOn: "", outcome: "", categories: [], source: source ?? { type: "", id: "", label: "" }, files: [],
  });
  const { a, save } = useSave<DutyDoc>("duties", d?.id, onDone);
  const set = (k: keyof Body<DutyDoc>) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-3">
      {f.source.type && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">From {f.source.type}: {f.source.label}</p>}
      <Field label="Duty"><Input value={f.title} onChange={set("title")} /></Field>
      <Field label="Details"><Textarea rows={2} value={f.details} onChange={set("details")} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Assigned by"><Input value={f.assignedBy} onChange={set("assignedBy")} /></Field>
        <Field label="Assigned on"><Input type="date" value={f.assignedOn} onChange={set("assignedOn")} /></Field>
        <Field label="Deadline"><Input type="date" value={f.deadline} onChange={set("deadline")} /></Field>
        <Field label="Remind (days before)"><Input value={f.remindDays.join(", ")} placeholder="7, 2, 0" onChange={(e) => setF({ ...f, remindDays: [...new Set(e.target.value.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 60))].slice(0, 6) })} /></Field>
      </div>
      <Field label="Categories (for reports)"><MultiSelect options={os.recordCategories} value={f.categories} onChange={(categories) => setF({ ...f, categories })} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as DutyDoc["status"], doneOn: e.target.value === "done" ? f.doneOn || todayInTz(ss.settings.timezone) : f.doneOn })}><option value="open">Open</option><option value="done">Done</option><option value="dropped">Dropped / withdrawn</option></Select></Field>
        {f.status === "done" && <Field label="Completed on"><Input type="date" value={f.doneOn} onChange={set("doneOn")} /></Field>}
      </div>
      {f.status !== "open" && <Field label="Outcome"><Textarea rows={2} value={f.outcome} onChange={set("outcome")} /></Field>}
      <Field label="Documents"><FileField value={f.files} onChange={(files) => setF({ ...f, files })} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.title.trim().length < 2} onClick={() => save(f)}>{d ? "Save" : "Add duty"}</Button>
    </div>
  );
}

export function OrderForm({ o, onDone }: { o?: OrderDoc; onDone: (id: string) => void }) {
  const ss = useSession();
  const os = useOfficeSettings();
  const [f, setF] = useState<Body<OrderDoc>>(o ? strip(o) : { number: "", date: todayInTz(ss.settings.timezone), type: "", title: "", issuedBy: "", mention: "", validFrom: "", validTo: "", categories: [], files: [] });
  const { a, save } = useSave<OrderDoc>("orders", o?.id, onDone);
  const set = (k: keyof Body<OrderDoc>) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Order number"><Input value={f.number} onChange={set("number")} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="Type"><ListInput options={os.orderTypes} value={f.type} onChange={(v) => setF({ ...f, type: v })} placeholder="Type" /></Field>
      </div>
      <Field label="Title / subject"><Input value={f.title} onChange={set("title")} /></Field>
      <Field label="Issued by"><Input value={f.issuedBy} onChange={set("issuedBy")} /></Field>
      <Field label="My responsibility / mention of me"><Textarea rows={3} value={f.mention} onChange={set("mention")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valid from"><Input type="date" value={f.validFrom} onChange={set("validFrom")} /></Field>
        <Field label="Valid to"><Input type="date" value={f.validTo} onChange={set("validTo")} /></Field>
      </div>
      <Field label="Categories (for reports)"><MultiSelect options={os.recordCategories} value={f.categories} onChange={(categories) => setF({ ...f, categories })} /></Field>
      <Field label="Order copy (PDF or image)"><FileField value={f.files} onChange={(files) => setF({ ...f, files })} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.title.trim().length < 2} onClick={() => save(f)}>{o ? "Save" : "Add order"}</Button>
    </div>
  );
}

export function RecordForm({ r, onDone }: { r?: RecordDoc; onDone: (id: string) => void }) {
  const ss = useSession();
  const os = useOfficeSettings();
  const [f, setF] = useState<Body<RecordDoc>>(r ? strip(r) : { title: "", categories: [], date: todayInTz(ss.settings.timezone), endDate: "", level: "", role: "", organisation: "", details: "", amount: "", url: "", cvSection: "", files: [] });
  const { a, save } = useSave<RecordDoc>("records", r?.id, onDone);
  const set = (k: keyof Body<RecordDoc>) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <Field label="Title"><Input value={f.title} onChange={set("title")} /></Field>
      <Field label="Categories" hint="Choose all that apply"><MultiSelect options={os.recordCategories} value={f.categories} onChange={(categories) => setF({ ...f, categories })} /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date"><Input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="End date (if a period)"><Input type="date" value={f.endDate} onChange={set("endDate")} /></Field>
        <Field label="Level"><Select value={f.level} onChange={set("level")}><option value="">—</option>{os.levels.map((l) => <option key={l}>{l}</option>)}</Select></Field>
        <Field label="My role"><Input value={f.role} placeholder="e.g. Speaker, PI, Member" onChange={set("role")} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Organisation / venue"><Input value={f.organisation} onChange={set("organisation")} /></Field>
        <Field label="Amount (if any)"><Input value={f.amount} placeholder="e.g. 12.5 lakh" onChange={set("amount")} /></Field>
        <Field label="Link"><Input value={f.url} placeholder="https://…" onChange={set("url")} /></Field>
      </div>
      <Field label="Details"><Textarea rows={3} value={f.details} onChange={set("details")} /></Field>
      <Field label="Show in CV under"><Select value={f.cvSection} onChange={set("cvSection")}><option value="">Not in CV</option>{os.cvSections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
      <Field label="Evidence (certificate, letter, photo)"><FileField value={f.files} onChange={(files) => setF({ ...f, files })} /></Field>
      <ErrorText>{a.error}</ErrorText>
      <Button disabled={a.busy || f.title.trim().length < 2 || !f.categories.length} onClick={() => save(f)}>{r ? "Save" : "Add record"}</Button>
    </div>
  );
}
