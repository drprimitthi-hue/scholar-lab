"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { collection } from "firebase/firestore";
import { fs } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { useLiveQuery } from "@/lib/client/hooks";
import { useSession } from "@/lib/client/session";
import { DEFAULT_TEMPLATES } from "@/lib/domain/defaults";
import type { LabSettings, MilestoneTemplate, MilestoneTemplateItem } from "@/lib/types";
import { SystemTab } from "@/components/SystemTab";
import { Button, Card, ErrorText, Field, Input, Notice, PageHeader, Select, Spinner, Tabs, Textarea, useAction } from "@/components/ui";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `id-${Date.now()}`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function General() {
  const s = useSession();
  const [f, setF] = useState<LabSettings>(s.settings);
  const [holidays, setHolidays] = useState(s.settings.holidays.join("\n"));
  const [statuses, setStatuses] = useState(s.settings.statuses.join("\n"));
  const a = useAction();
  const set = <K extends keyof LabSettings>(k: K, v: LabSettings[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await a.run(() =>
      api("/api/settings", "PUT", {
        ...f,
        holidays: holidays.split(/\s+/).map((x) => x.trim()).filter(Boolean),
        statuses: statuses.split("\n").map((x) => x.trim()).filter(Boolean),
      }),
    "Settings saved");
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Card title="Lab identity (shown on the public website)">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Lab name"><Input required value={f.labName} onChange={(e) => set("labName", e.target.value)} /></Field>
          <Field label="Supervisor / PI name"><Input value={f.supervisorName} onChange={(e) => set("supervisorName", e.target.value)} /></Field>
          <Field label="Institution"><Input value={f.institution} onChange={(e) => set("institution", e.target.value)} /></Field>
          <Field label="Department / school"><Input value={f.department} onChange={(e) => set("department", e.target.value)} /></Field>
          <Field label="Accent colour"><div className="flex gap-2"><input type="color" value={f.accent} onChange={(e) => set("accent", e.target.value)} className="h-10 w-14 rounded border border-line" /><Input value={f.accent} onChange={(e) => set("accent", e.target.value)} /></div></Field>
          <Field label="Time zone" hint="IANA name, e.g. Asia/Kolkata"><Input value={f.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
        </div>
        <div className="mt-3"><Field label="Tagline / about"><Textarea value={f.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field></div>
      </Card>

      <Card title="Programmes" action={<Button type="button" variant="ghost" onClick={() => set("programmes", [...f.programmes, { id: `prog-${f.programmes.length + 1}`, name: "", level: "master" }])}>Add</Button>}>
        <div className="space-y-2">
          {f.programmes.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input className="col-span-3" placeholder="id" value={p.id} onChange={(e) => set("programmes", f.programmes.map((x, j) => (j === i ? { ...x, id: slug(e.target.value) } : x)))} />
              <Input className="col-span-5" placeholder="Name" value={p.name} onChange={(e) => set("programmes", f.programmes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Select className="col-span-3" value={p.level} onChange={(e) => set("programmes", f.programmes.map((x, j) => (j === i ? { ...x, level: e.target.value as "phd" } : x)))}>
                <option value="phd">Doctoral</option><option value="master">Master</option><option value="bachelor">Bachelor</option>
              </Select>
              <Button type="button" variant="ghost" className="col-span-1" onClick={() => set("programmes", f.programmes.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <p className="text-xs text-muted">Changing a programme id does not move existing scholars; prefer editing names.</p>
        </div>
      </Card>

      <Card title="Leave" action={<Button type="button" variant="ghost" onClick={() => set("leaveTypes", [...f.leaveTypes, { id: `leave-${f.leaveTypes.length + 1}`, name: "", yearlyQuota: 0 }])}>Add type</Button>}>
        <div className="space-y-2">
          {f.leaveTypes.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input className="col-span-3" value={t.id} onChange={(e) => set("leaveTypes", f.leaveTypes.map((x, j) => (j === i ? { ...x, id: slug(e.target.value) } : x)))} />
              <Input className="col-span-5" placeholder="Name" value={t.name} onChange={(e) => set("leaveTypes", f.leaveTypes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input className="col-span-3" type="number" min={0} title="Yearly quota (0 = no limit)" value={t.yearlyQuota} onChange={(e) => set("leaveTypes", f.leaveTypes.map((x, j) => (j === i ? { ...x, yearlyQuota: Number(e.target.value) } : x)))} />
              <Button type="button" variant="ghost" className="col-span-1" onClick={() => set("leaveTypes", f.leaveTypes.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <p className="text-xs text-muted">Columns: id · name · yearly quota in days (0 = no limit).</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Weekly off days">
            <div className="flex flex-wrap gap-3 pt-1">{DAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.weekendDays.includes(i)} onChange={(e) => set("weekendDays", e.target.checked ? [...f.weekendDays, i] : f.weekendDays.filter((x) => x !== i))} />{d}</label>
            ))}</div>
          </Field>
          <Field label="Holidays (one YYYY-MM-DD per line)"><Textarea rows={4} value={holidays} onChange={(e) => setHolidays(e.target.value)} /></Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.mentorCanApproveLeave} onChange={(e) => set("mentorCanApproveLeave", e.target.checked)} />Mentors may approve leave of their scholars</label>
      </Card>

      <Card title="Presence">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.mentorCanCorrectPresence} onChange={(e) => set("mentorCanCorrectPresence", e.target.checked)} />Mentors may correct presence of their scholars</label>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.geofence.enabled} onChange={(e) => set("geofence", { ...f.geofence, enabled: e.target.checked })} />Allow check-in only on campus (only a yes/no is stored, never the location)</label>
        {f.geofence.enabled && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="Campus latitude"><Input type="number" step="any" value={f.geofence.lat} onChange={(e) => set("geofence", { ...f.geofence, lat: Number(e.target.value) })} /></Field>
            <Field label="Campus longitude"><Input type="number" step="any" value={f.geofence.lng} onChange={(e) => set("geofence", { ...f.geofence, lng: Number(e.target.value) })} /></Field>
            <Field label="Radius (metres)"><Input type="number" min={50} value={f.geofence.radiusM} onChange={(e) => set("geofence", { ...f.geofence, radiusM: Number(e.target.value) })} /></Field>
          </div>
        )}
      </Card>

      <Card title="Records & security">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Enrolment statuses (one per line)"><Textarea rows={5} value={statuses} onChange={(e) => setStatuses(e.target.value)} /></Field>
          <Field label="Sign out after inactivity (minutes)"><Input type="number" min={5} max={240} value={f.idleMinutes} onChange={(e) => set("idleMinutes", Number(e.target.value))} /></Field>
        </div>
      </Card>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}

function Templates() {
  const s = useSession();
  const { data, loading } = useLiveQuery<MilestoneTemplate>(() => collection(fs(), "milestoneTemplates"), "templates");
  const [prog, setProg] = useState(s.settings.programmes[0]?.id ?? "");
  const current = data.find((t) => t.programmeId === prog) ?? DEFAULT_TEMPLATES.find((t) => t.programmeId === prog);
  if (loading) return <Spinner />;
  return (
    <Card title="Degree milestone templates">
      <p className="mb-4 text-sm text-muted">Used when a scholar is added. Due date = joining date + offset months. Existing scholars are not changed.</p>
      <Select className="mb-4 max-w-xs" value={prog} onChange={(e) => setProg(e.target.value)}>{s.settings.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <TemplateEditor key={`${prog}:${JSON.stringify(current?.items ?? [])}`} programmeId={prog} initial={current?.items ?? []} />
    </Card>
  );
}

function TemplateEditor({ programmeId, initial }: { programmeId: string; initial: MilestoneTemplateItem[] }) {
  const [items, setItems] = useState(initial);
  const a = useAction();
  const upd = (i: number, patch: Partial<MilestoneTemplateItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs text-muted"><span className="col-span-5">Milestone</span><span className="col-span-2">Weight</span><span className="col-span-2">Offset (months)</span><span className="col-span-2">Repeat every / times</span></div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <Input className="col-span-5" value={it.title} onChange={(e) => upd(i, { title: e.target.value })} />
          <Input className="col-span-2" type="number" min={0} value={it.weight} onChange={(e) => upd(i, { weight: Number(e.target.value) })} />
          <Input className="col-span-2" type="number" min={0} value={it.offsetMonths} onChange={(e) => upd(i, { offsetMonths: Number(e.target.value) })} />
          <div className="col-span-2 flex gap-1">
            <Input type="number" min={0} placeholder="—" value={it.repeatEveryMonths ?? ""} onChange={(e) => upd(i, { repeatEveryMonths: e.target.value ? Number(e.target.value) : undefined })} />
            <Input type="number" min={0} placeholder="—" value={it.repeatCount ?? ""} onChange={(e) => upd(i, { repeatCount: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <Button type="button" variant="ghost" className="col-span-1" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</Button>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => setItems([...items, { key: `m${Date.now().toString(36)}`, title: "", weight: 5, offsetMonths: 0 }])}>Add milestone</Button>
        <Button type="button" disabled={a.busy} onClick={() => a.run(() => api(`/api/templates/${programmeId}`, "PUT", { items: items.map((x) => ({ ...x, repeatEveryMonths: x.repeatEveryMonths || undefined, repeatCount: x.repeatCount || undefined })) }), "Template saved")}>Save template</Button>
      </div>
      <ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice>
    </div>
  );
}

export default function SettingsPage() {
  const s = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "general";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  if (s.role !== "supervisor") return <ErrorText>Only the supervisor can change settings.</ErrorText>;
  return (
    <>
      <PageHeader title="Settings" subtitle="Everything here is editable — nothing is fixed in the code." />
      <Tabs tabs={[{ id: "general", label: "General" }, { id: "templates", label: "Milestone templates" }, { id: "system", label: "System" }]} value={tab} onChange={setTab} />
      {tab === "general" ? <General key={JSON.stringify(s.settings)} /> : tab === "templates" ? <Templates /> : <SystemTab />}
    </>
  );
}
