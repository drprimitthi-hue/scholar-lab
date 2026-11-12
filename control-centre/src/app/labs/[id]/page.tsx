"use client";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { labAlerts } from "@/lib/alerts";
import type { Lab } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Field, Input, Notice, PageHeader, Select, Spinner, Tabs, useAction } from "@/components/ui";
import { LabForm } from "@/components/LabForm";
import { Reauth } from "@/components/Reauth";
import { Shell } from "@/components/Shell";

interface Hist { action: string; by: string; at: number; detail: unknown }
const dt = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString("en-GB") : "—");

function Copy({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="grid grid-cols-[14rem_1fr_auto] items-center gap-2 border-b border-line/60 py-1.5 text-xs last:border-0">
      <code className="font-mono font-medium">{label}</code>
      <code className="truncate font-mono text-muted" title={value}>{value || "—"}</code>
      <button type="button" disabled={!value} className="rounded border border-line px-2 py-0.5 hover:bg-canvas disabled:opacity-40" onClick={() => navigator.clipboard.writeText(value).then(() => setOk(true))}>{ok ? "Copied" : "Copy"}</button>
    </div>
  );
}

function LabView({ id }: { id: string }) {
  const [data, setData] = useState<{ lab: Lab; history: Hist[] } | null>(null);
  const [me, setMe] = useState<{ publicKey: string; controlCentreUrl: string; keysConfigured: boolean } | null>(null);
  const [tab, setTab] = useState("licence");
  const [confirm, setConfirm] = useState<null | (() => Promise<void>)>(null);
  const [lic, setLic] = useState({ expiresOn: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10), graceDays: 30, never: false });
  const [stat, setStat] = useState({ status: "active", message: "", readOnlyDays: 30 });
  const [secrets, setSecrets] = useState<{ setupToken: string; cronSecret: string } | null>(null);
  const a = useAction();
  const load = () => api<{ lab: Lab; history: Hist[] }>(`/api/labs/${id}`).then(setData).catch((e: Error) => a.setError(e.message));
  useEffect(() => { load(); api<typeof me>("/api/me").then(setMe).catch(() => undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  if (!data) return a.error ? <ErrorText>{a.error}</ErrorText> : <Spinner />;
  const { lab } = data;
  const sensitive = (fn: () => Promise<void>) => setConfirm(() => fn);

  return (
    <>
      <PageHeader title={lab.labName} subtitle={`${lab.faculty.name} · ${lab.faculty.institution || "—"} · id: ${lab.id}`} action={<Badge tone={lab.status === "active" ? "ok" : lab.status === "suspended" ? "warn" : "bad"}>{lab.status}</Badge>} />
      <div className="mb-4 flex flex-wrap gap-2">{labAlerts(lab, Date.now(), null).map((x) => <Badge key={x.text} tone={x.tone}>{x.text}</Badge>)}</div>
      <Tabs tabs={[{ id: "licence", label: "Licence & access" }, { id: "deploy", label: "Site settings" }, { id: "details", label: "Details & handover" }, { id: "history", label: "History" }]} value={tab} onChange={setTab} />
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      {confirm && (
        <Card title="Confirm it's you" className="mb-5"><Reauth label="Confirm" onDone={async () => { const fn = confirm; setConfirm(null); await fn(); }} /></Card>
      )}

      {tab === "licence" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Licence key">
            <dl className="mb-4 space-y-1 text-sm">
              <div><span className="text-muted">Issued:</span> {dt(lab.licence?.iat)}</div>
              <div><span className="text-muted">Expires:</span> {lab.licence ? (lab.licence.exp ? dt(lab.licence.exp) : "Never") : "—"} {lab.licence && `· grace ${lab.licence.grace} days read-only`}</div>
              <div><span className="text-muted">Last check-in:</span> {dt(lab.lastHeartbeat?.at)} {lab.lastHeartbeat && `· version ${lab.lastHeartbeat.version} · ${lab.lastHeartbeat.domain}`}</div>
            </dl>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Expires on"><Input type="date" disabled={lic.never} value={lic.expiresOn} onChange={(e) => setLic({ ...lic, expiresOn: e.target.value })} /></Field>
              <Field label="Grace (days)"><Input type="number" className="w-24" min={0} max={180} value={lic.graceDays} onChange={(e) => setLic({ ...lic, graceDays: Number(e.target.value) })} /></Field>
              <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={lic.never} onChange={(e) => setLic({ ...lic, never: e.target.checked })} />No expiry</label>
            </div>
            <Button className="mt-3" disabled={a.busy || !me?.keysConfigured} onClick={() => sensitive(async () => { await a.run(() => api(`/api/labs/${id}/licence`, "POST", { expiresOn: lic.never ? "" : lic.expiresOn, graceDays: lic.graceDays }), lab.licence ? "Renewed — the lab picks it up at its next daily check-in." : "Licence issued — copy LICENCE_KEY from Site settings."); load(); })}>{lab.licence ? "Renew / change expiry" : "Issue licence"}</Button>
            {!me?.keysConfigured && <p className="mt-2 text-xs text-bad">Licence keys are not configured in this Control Centre.</p>}
          </Card>
          <Card title="Access">
            <p className="mb-3 text-sm text-muted">Takes effect at the lab&apos;s next daily check-in. Suspended = read-only. Revoked = read-only for the chosen days (so they can export their records), then locked. Their data is never deleted.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Set status"><Select value={stat.status} onChange={(e) => setStat({ ...stat, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended (read-only)</option><option value="revoked">Revoked</option></Select></Field>
              {stat.status === "revoked" && <Field label="Read-only days before lock"><Input type="number" min={0} max={180} value={stat.readOnlyDays} onChange={(e) => setStat({ ...stat, readOnlyDays: Number(e.target.value) })} /></Field>}
            </div>
            <div className="mt-3"><Field label="Message shown to the lab"><Input value={stat.message} onChange={(e) => setStat({ ...stat, message: e.target.value })} /></Field></div>
            <Button variant={stat.status === "active" ? "primary" : "danger"} className="mt-3" disabled={a.busy} onClick={() => sensitive(async () => { await a.run(() => api(`/api/labs/${id}/status`, "POST", stat), "Status updated"); load(); })}>Apply</Button>
          </Card>
        </div>
      )}

      {tab === "deploy" && (
        <Card title="Environment variables for this lab's Vercel project">
          <p className="mb-3 text-sm text-muted">Paste these into the lab&apos;s Vercel project (Settings → Environment Variables), together with the lab&apos;s own Firebase values (NEXT_PUBLIC_FIREBASE_* and FIREBASE_SERVICE_ACCOUNT_JSON, the whole key file pasted). Then open the site&apos;s <code>/setup</code> page with the SETUP_TOKEN.</p>
          <Copy label="LAB_ID" value={lab.id} />
          <Copy label="LICENCE_KEY" value={lab.licence?.token ?? ""} />
          <Copy label="LICENCE_PUBLIC_KEY" value={me?.publicKey ?? ""} />
          <Copy label="CONTROL_CENTRE_URL" value={me?.controlCentreUrl ?? ""} />
          <Copy label="SETUP_TOKEN" value={secrets?.setupToken ?? ""} />
          <Copy label="CRON_SECRET" value={secrets?.cronSecret ?? ""} />
          {!lab.licence && <p className="mt-2 text-xs text-warn">Issue a licence first to get LICENCE_KEY.</p>}
          <Button variant="soft" className="mt-4" disabled={a.busy} onClick={() => sensitive(async () => { await a.run(async () => setSecrets(await api(`/api/labs/${id}/secrets`, "POST"))); })}>Generate SETUP_TOKEN and CRON_SECRET</Button>
          <p className="mt-2 text-xs text-muted">Generated values are shown once and not stored here. Mark them as Sensitive in Vercel.</p>
        </Card>
      )}

      {tab === "details" && <LabForm key={lab.updatedAt} lab={lab} onSave={async (body) => { await api(`/api/labs/${id}`, "PATCH", body); await load(); }} />}

      {tab === "history" && (
        <Card title="History">
          <ul className="divide-y divide-line/60 text-sm">
            {data.history.map((h, i) => <li key={i} className="flex justify-between gap-3 py-2"><span><code className="text-xs">{h.action}</code> <span className="text-muted">by {h.by}</span></span><span className="text-xs text-muted">{dt(h.at)}</span></li>)}
          </ul>
        </Card>
      )}
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell><LabView id={id} /></Shell>;
}
