"use client";
import { useState } from "react";
import type { Lab } from "@/lib/types";
import { Button, Card, ErrorText, Field, Input, Textarea, useAction } from "./ui";

type F = Pick<Lab, "labName" | "faculty" | "domains" | "joinedOn" | "agreementRef" | "firebaseProjectId" | "vercelProject" | "siteUrl" | "notes" | "handover">;
const EMPTY: F = {
  labName: "", faculty: { name: "", designation: "", department: "", institution: "", email: "", phone: "" }, domains: [], joinedOn: new Date().toISOString().slice(0, 10),
  agreementRef: "", firebaseProjectId: "", vercelProject: "", siteUrl: "", notes: "",
  handover: { firebaseCreated: "", ownerInvited: "", ownerAccepted: "", billingSwitched: "", adminRemoved: "", agreementSigned: "" },
};
const STEPS: [keyof F["handover"], string][] = [
  ["firebaseCreated", "Firebase project created & lab set up"],
  ["ownerInvited", "Faculty invited as Firebase Owner"],
  ["ownerAccepted", "Faculty accepted ownership"],
  ["billingSwitched", "Billing switched to faculty / institution"],
  ["adminRemoved", "You removed yourself from their Firebase"],
  ["agreementSigned", "Data-processing agreement signed"],
];

export function LabForm({ lab, withId, onSave }: { lab?: Lab; withId?: boolean; onSave: (body: F & { id?: string }) => Promise<void> }) {
  const [f, setF] = useState<F>(lab ? { labName: lab.labName, faculty: lab.faculty, domains: lab.domains, joinedOn: lab.joinedOn, agreementRef: lab.agreementRef, firebaseProjectId: lab.firebaseProjectId, vercelProject: lab.vercelProject, siteUrl: lab.siteUrl, notes: lab.notes, handover: lab.handover } : EMPTY);
  const [id, setId] = useState("");
  const [domains, setDomains] = useState(f.domains.join(", "));
  const a = useAction();
  const fac = (k: keyof F["faculty"], v: string) => setF({ ...f, faculty: { ...f.faculty, [k]: v } });
  return (
    <form className="space-y-5" onSubmit={async (e) => { e.preventDefault(); await a.run(() => onSave({ ...f, domains: domains.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean), ...(withId ? { id } : {}) }), "Saved"); }}>
      <Card title="Faculty member">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name"><Input required value={f.faculty.name} onChange={(e) => fac("name", e.target.value)} /></Field>
          <Field label="Designation"><Input value={f.faculty.designation} onChange={(e) => fac("designation", e.target.value)} /></Field>
          <Field label="Department / school"><Input value={f.faculty.department} onChange={(e) => fac("department", e.target.value)} /></Field>
          <Field label="Institution"><Input value={f.faculty.institution} onChange={(e) => fac("institution", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={f.faculty.email} onChange={(e) => fac("email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={f.faculty.phone} onChange={(e) => fac("phone", e.target.value)} /></Field>
        </div>
      </Card>
      <Card title="Lab">
        <div className="grid gap-3 md:grid-cols-2">
          {withId && <Field label="Lab id (permanent)" hint="e.g. sharma-iot-lab"><Input required pattern="[a-z0-9-]{3,40}" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} /></Field>}
          <Field label="Lab name"><Input required value={f.labName} onChange={(e) => setF({ ...f, labName: e.target.value })} /></Field>
          <Field label="Date of joining"><Input type="date" value={f.joinedOn} onChange={(e) => setF({ ...f, joinedOn: e.target.value })} /></Field>
          <Field label="Agreement / approval reference"><Input value={f.agreementRef} onChange={(e) => setF({ ...f, agreementRef: e.target.value })} /></Field>
          <Field label="Website domains" hint="Comma separated, e.g. sharmalab.in"><Input value={domains} onChange={(e) => setDomains(e.target.value)} /></Field>
          <Field label="Site URL"><Input placeholder="https://…" value={f.siteUrl} onChange={(e) => setF({ ...f, siteUrl: e.target.value })} /></Field>
          <Field label="Firebase project id"><Input value={f.firebaseProjectId} onChange={(e) => setF({ ...f, firebaseProjectId: e.target.value })} /></Field>
          <Field label="Vercel project name"><Input value={f.vercelProject} onChange={(e) => setF({ ...f, vercelProject: e.target.value })} /></Field>
        </div>
        <div className="mt-3"><Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
      </Card>
      <Card title="Handover checklist">
        <div className="space-y-2">
          {STEPS.map(([k, label]) => (
            <div key={k} className="grid grid-cols-[1fr_11rem] items-center gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(f.handover[k])} onChange={(e) => setF({ ...f, handover: { ...f.handover, [k]: e.target.checked ? new Date().toISOString().slice(0, 10) : "" } })} />{label}</label>
              <Input type="date" value={f.handover[k]} onChange={(e) => setF({ ...f, handover: { ...f.handover, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
      </Card>
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Saving…" : withId ? "Add lab" : "Save changes"}</Button>
    </form>
  );
}
