"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { formatDate } from "@/lib/domain/dates";
import { monthsRemaining } from "@/lib/domain/milestones";
import { todayInTz } from "@/lib/domain/dates";
import type { Qualification, ScholarDoc } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Field, Input, Notice, Select, Textarea, useAction } from "../ui";
import { programmeName } from "../scholar-bits";

type Form = Omit<ScholarDoc, "uid" | "mentorUids" | "email" | "photoPath" | "deletion" | "createdAt" | "updatedAt">;
const KEYS: (keyof Form)[] = [
  "name", "phone", "emergencyContact", "address", "enrolmentNo", "programmeId", "specialisation", "batch", "joiningDate", "mode",
  "status", "researchTopic", "expectedCompletion", "funding", "fundingFrom", "fundingTo", "coSupervisor", "committeeMembers",
  "proposalApprovedOn", "minDurationMonths", "maxDurationMonths", "extensions", "qualifications",
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-line/60 py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 whitespace-pre-wrap">{value || <span className="text-muted">—</span>}</dd>
    </div>
  );
}

export function Enrolment({ scholar }: { scholar: ScholarDoc }) {
  const s = useSession();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<Form>(() => Object.fromEntries(KEYS.map((k) => [k, scholar[k]])) as unknown as Form);
  const a = useAction();
  const isResearch = s.settings.programmes.find((p) => p.id === scholar.programmeId)?.level === "phd";
  const remain = monthsRemaining(scholar.joiningDate, scholar.maxDurationMonths, todayInTz(s.settings.timezone));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await a.run(() => api(`/api/scholars/${scholar.uid}`, "PATCH", f), "Saved");
    if (ok) setEdit(false);
  }

  if (!edit)
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Academic record" action={s.role === "supervisor" && !scholar.deletion && <Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button>}>
          <dl>
            <Row label="Enrolment no." value={scholar.enrolmentNo} />
            <Row label="Programme" value={programmeName(s.settings, scholar.programmeId)} />
            <Row label="Specialisation" value={scholar.specialisation} />
            <Row label="Batch" value={scholar.batch} />
            <Row label="Joining date" value={formatDate(scholar.joiningDate)} />
            <Row label="Mode" value={scholar.mode === "part_time" ? "Part-time" : "Full-time"} />
            <Row label="Status" value={<Badge tone="accent">{scholar.status}</Badge>} />
            <Row label="Research topic" value={scholar.researchTopic} />
            <Row label="Expected completion" value={formatDate(scholar.expectedCompletion)} />
          </dl>
          <Notice>{a.done}</Notice>
        </Card>
        <Card title="Contact">
          <dl>
            <Row label="Email" value={scholar.email} />
            <Row label="Phone" value={scholar.phone} />
            <Row label="Emergency contact" value={scholar.emergencyContact} />
            <Row label="Address" value={scholar.address} />
          </dl>
        </Card>
        {(isResearch || scholar.maxDurationMonths > 0 || scholar.funding) && (
          <Card title="Research-degree details">
            <dl>
              <Row label="Funding / fellowship" value={scholar.funding} />
              <Row label="Funding period" value={scholar.fundingFrom ? `${formatDate(scholar.fundingFrom)} – ${formatDate(scholar.fundingTo)}` : ""} />
              <Row label="Co-supervisor" value={scholar.coSupervisor} />
              <Row label="Committee members" value={scholar.committeeMembers} />
              <Row label="Proposal approved" value={formatDate(scholar.proposalApprovedOn)} />
              <Row label="Duration (min / max)" value={scholar.maxDurationMonths ? `${scholar.minDurationMonths} / ${scholar.maxDurationMonths} months` : ""} />
              <Row label="Time remaining" value={remain === null ? "" : remain < 0 ? <Badge tone="bad">Exceeded by {-remain} months</Badge> : <Badge tone={remain < 6 ? "warn" : "neutral"}>{remain} months</Badge>} />
              <Row label="Extensions" value={scholar.extensions} />
            </dl>
          </Card>
        )}
        {s.role === "scholar" && s.user?.uid === scholar.uid && <WebsiteConsent scholar={scholar} />}
        <Card title="Prior qualifications">
          {scholar.qualifications.length ? (
            <ul className="space-y-2 text-sm">
              {scholar.qualifications.map((q, i) => <li key={i}><span className="font-medium">{q.degree}</span> · {q.institute} · {q.year} {q.score && `· ${q.score}`}</li>)}
            </ul>
          ) : <p className="text-sm text-muted">—</p>}
        </Card>
      </div>
    );

  const q = f.qualifications;
  const setQ = (i: number, k: keyof Qualification, v: string) => set("qualifications", q.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <form onSubmit={save} className="space-y-5">
      <Card title="Academic record">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name"><Input required value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Enrolment no."><Input value={f.enrolmentNo} onChange={(e) => set("enrolmentNo", e.target.value)} /></Field>
          <Field label="Programme"><Select value={f.programmeId} onChange={(e) => set("programmeId", e.target.value)}>{s.settings.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{s.settings.statuses.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Specialisation"><Input value={f.specialisation} onChange={(e) => set("specialisation", e.target.value)} /></Field>
          <Field label="Batch"><Input value={f.batch} onChange={(e) => set("batch", e.target.value)} /></Field>
          <Field label="Joining date"><Input type="date" required value={f.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} /></Field>
          <Field label="Mode"><Select value={f.mode} onChange={(e) => set("mode", e.target.value as Form["mode"])}><option value="full_time">Full-time</option><option value="part_time">Part-time</option></Select></Field>
          <Field label="Research topic"><Input value={f.researchTopic} onChange={(e) => set("researchTopic", e.target.value)} /></Field>
          <Field label="Expected completion"><Input type="date" value={f.expectedCompletion} onChange={(e) => set("expectedCompletion", e.target.value)} /></Field>
        </div>
      </Card>
      <Card title="Contact">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Emergency contact"><Input value={f.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} /></Field>
        </div>
        <div className="mt-3"><Field label="Address"><Textarea value={f.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
      </Card>
      <Card title="Research-degree details (optional)">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Funding / fellowship"><Input value={f.funding} onChange={(e) => set("funding", e.target.value)} /></Field>
          <Field label="Co-supervisor"><Input value={f.coSupervisor} onChange={(e) => set("coSupervisor", e.target.value)} /></Field>
          <Field label="Funding from"><Input type="date" value={f.fundingFrom} onChange={(e) => set("fundingFrom", e.target.value)} /></Field>
          <Field label="Funding to"><Input type="date" value={f.fundingTo} onChange={(e) => set("fundingTo", e.target.value)} /></Field>
          <Field label="Proposal approved on"><Input type="date" value={f.proposalApprovedOn} onChange={(e) => set("proposalApprovedOn", e.target.value)} /></Field>
          <Field label="Committee members"><Input value={f.committeeMembers} onChange={(e) => set("committeeMembers", e.target.value)} /></Field>
          <Field label="Minimum duration (months)"><Input type="number" min={0} max={240} value={f.minDurationMonths} onChange={(e) => set("minDurationMonths", Number(e.target.value))} /></Field>
          <Field label="Maximum duration (months)"><Input type="number" min={0} max={240} value={f.maxDurationMonths} onChange={(e) => set("maxDurationMonths", Number(e.target.value))} /></Field>
        </div>
        <div className="mt-3"><Field label="Extensions granted"><Textarea value={f.extensions} onChange={(e) => set("extensions", e.target.value)} /></Field></div>
      </Card>
      <Card title="Prior qualifications" action={<Button type="button" variant="ghost" disabled={q.length >= 10} onClick={() => set("qualifications", [...q, { degree: "", institute: "", year: "", score: "" }])}>Add</Button>}>
        <div className="space-y-2">
          {q.map((x, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Input placeholder="Degree" value={x.degree} onChange={(e) => setQ(i, "degree", e.target.value)} />
              <Input placeholder="Institute" className="md:col-span-2" value={x.institute} onChange={(e) => setQ(i, "institute", e.target.value)} />
              <Input placeholder="Year" value={x.year} onChange={(e) => setQ(i, "year", e.target.value)} />
              <div className="flex gap-2"><Input placeholder="Score" value={x.score} onChange={(e) => setQ(i, "score", e.target.value)} /><Button type="button" variant="ghost" onClick={() => set("qualifications", q.filter((_, j) => j !== i))} aria-label="Remove">✕</Button></div>
            </div>
          ))}
        </div>
      </Card>
      <ErrorText>{a.error}</ErrorText>
      <div className="flex gap-2"><Button type="submit" disabled={a.busy}>{a.busy ? "Saving…" : "Save changes"}</Button><Button type="button" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button></div>
    </form>
  );
}

function WebsiteConsent({ scholar }: { scholar: ScholarDoc }) {
  const a = useAction();
  const on = scholar.publicConsent === true;
  return (
    <Card title="Lab website">
      <p className="text-sm text-muted">If you agree, your <b>name, programme, research topic and years</b> appear on the lab&apos;s public website (People page and your projects). Nothing else is shown. You can change this at any time.</p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={on} disabled={a.busy} onChange={(e) => a.run(() => api("/api/me/public-consent", "PUT", { consent: e.target.checked }))} />
        Show me on the lab website
      </label>
      <ErrorText>{a.error}</ErrorText>
    </Card>
  );
}
