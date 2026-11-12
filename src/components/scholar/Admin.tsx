"use client";
import { useState } from "react";
import { doc } from "firebase/firestore";
import { fs } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { useUsers } from "@/lib/client/data";
import { useLiveDoc } from "@/lib/client/hooks";
import { Reauth } from "../Reauth";
import { TempPassword } from "../TempPassword";
import { formatDate } from "@/lib/domain/dates";
import type { ScholarDoc } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Field, Input, Notice, Textarea, useAction } from "../ui";

export function Admin({ scholar }: { scholar: ScholarDoc }) {
  const users = useUsers();
  const account = users.data.find((u) => u.uid === scholar.uid);
  const mentors = users.data.filter((u) => u.role === "mentor");
  const [sel, setSel] = useState<string[]>(scholar.mentorUids);
  const notesDoc = useLiveDoc<{ notes: string }>(() => doc(fs(), "scholarNotes", scholar.uid), `notes:${scholar.uid}`);
  const [notes, setNotes] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [delStep, setDelStep] = useState<"idle" | "reauth" | "confirm">("idle");
  const [confirmName, setConfirmName] = useState("");
  const [keepMinimal, setKeepMinimal] = useState(true);
  const a = useAction();

  const act = (action: string) =>
    a.run(async () => {
      const r = await api<{ tempPassword?: string }>(`/api/admin/users/${scholar.uid}`, "PATCH", { action });
      if (r.tempPassword) setTemp(r.tempPassword);
    }, "Done");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Mentors">
        {!mentors.length ? <p className="text-sm text-muted">No mentor accounts yet (create them under Accounts).</p> : (
          <div className="space-y-2">
            {mentors.map((m) => (
              <label key={m.uid} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sel.includes(m.uid)} onChange={(e) => setSel(e.target.checked ? [...sel, m.uid] : sel.filter((x) => x !== m.uid))} />
                {m.name} <span className="text-muted">({m.email})</span>
              </label>
            ))}
            <Button variant="soft" disabled={a.busy} onClick={() => a.run(() => api(`/api/scholars/${scholar.uid}/mentors`, "PUT", { mentorUids: sel }), "Mentors updated")}>Save mentors</Button>
          </div>
        )}
      </Card>

      <Card title="Private notes" action={<Badge>Only you can see these</Badge>}>
        <Textarea rows={5} value={notes ?? notesDoc.data?.notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        <Button className="mt-2" variant="soft" disabled={a.busy || notes === null} onClick={() => a.run(() => api(`/api/scholars/${scholar.uid}/notes`, "PUT", { notes: notes ?? "" }), "Notes saved")}>Save notes</Button>
      </Card>

      <Card title="Account">
        <p className="mb-3 text-sm">Status: <Badge tone={account?.status === "active" ? "ok" : "warn"}>{account?.status ?? "—"}</Badge> · Role: <Badge>{account?.role ?? "—"}</Badge></p>
        {!scholar.deletion && (
          <div className="flex flex-wrap gap-2">
            {account?.status === "active" ? <Button variant="ghost" onClick={() => act("disable")}>Disable sign-in</Button> : <Button variant="ghost" onClick={() => act("enable")}>Enable sign-in</Button>}
            <Button variant="ghost" onClick={() => act("reset_password")}>Reset password</Button>
            {account?.role === "scholar" ? <Button variant="ghost" onClick={() => act("archive")}>Archive (alumni, read-only)</Button> : account?.role === "alumni" && <Button variant="ghost" onClick={() => act("unarchive")}>Restore to active scholar</Button>}
          </div>
        )}
        {temp && account && <div className="mt-4"><TempPassword email={account.email} password={temp} /></div>}
      </Card>

      <Card title="Permanent deletion">
        {scholar.deletion ? (
          <div className="space-y-3 text-sm">
            <p>Scheduled. The record will be permanently deleted after <b>{formatDate(new Date(scholar.deletion.purgeAfter).toISOString().slice(0, 10))}</b> ({scholar.deletion.keepMinimal ? "keeping a minimal supervision record" : "full erasure"}).</p>
            <Button variant="ghost" onClick={() => a.run(() => api(`/api/scholars/${scholar.uid}/deletion`, "DELETE"), "Deletion cancelled; access restored")}>Cancel deletion</Button>
          </div>
        ) : delStep === "idle" ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">This is an official record. Use archiving for scholars who have completed. Deletion is permanent after a 7-day restore window.</p>
            <Button variant="danger" onClick={() => setDelStep("reauth")}>Delete this scholar&apos;s data…</Button>
          </div>
        ) : delStep === "reauth" ? (
          <><p className="mb-3 text-sm">Confirm it&apos;s you.</p><Reauth onDone={() => setDelStep("confirm")} /></>
        ) : (
          <div className="space-y-3 text-sm">
            <Field label={`Type the scholar's name to confirm: ${scholar.name}`}><Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} /></Field>
            <label className="flex items-center gap-2"><input type="checkbox" checked={keepMinimal} onChange={(e) => setKeepMinimal(e.target.checked)} />Keep a minimal supervision record (name, programme, years, topic, final status)</label>
            <div className="flex gap-2">
              <Button variant="danger" disabled={a.busy} onClick={async () => { if (await a.run(() => api(`/api/scholars/${scholar.uid}/deletion`, "POST", { confirmName, keepMinimal }))) setDelStep("idle"); }}>Schedule deletion</Button>
              <Button variant="ghost" onClick={() => setDelStep("idle")}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>
      <div className="lg:col-span-2"><ErrorText>{a.error || users.error}</ErrorText><Notice>{a.done}</Notice></div>
    </div>
  );
}
