"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { Reauth } from "./Reauth";
import { Badge, Button, Card, ErrorText, Notice, useAction } from "./ui";

interface Info { level: string; reason: string; expiresAt: number | null; lastCheck: number | null; labId: string | null; version: string; build: string; configured: boolean }
const d = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-GB") : "—");

function StorageCard() {
  const [s, setS] = useState<{ provider: "cloudinary" | "firebase"; cloudinaryConfigured: boolean; firebaseBucket: boolean } | null>(null);
  const [reauth, setReauth] = useState<"test" | "copy" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const a = useAction();
  useEffect(() => { api<typeof s>("/api/system/storage").then(setS).catch(() => undefined); }, []);
  const test = () => a.run(async () => {
    const r = await api<{ ok: boolean; detail: string }>("/api/system/storage", "POST", { action: "test" });
    if (!r.ok) throw new Error(r.detail);
    setProgress(r.detail);
  });
  const copy = () => a.run(async () => {
    let stage = 0, cursor = "", total = 0, failed = 0;
    for (;;) {
      const r = await api<{ done: boolean; copied: number; failed: string[]; stage: number; cursor: string }>("/api/system/storage", "POST", { action: "copy", stage, cursor });
      total += r.copied; failed += r.failed.length;
      setProgress(`Copied ${total} file(s)${failed ? `, ${failed} failed` : ""}…`);
      if (r.done) break;
      stage = r.stage; cursor = r.cursor;
    }
    setProgress(`Done: ${total} file(s) copied${failed ? `, ${failed} failed (run again to retry)` : ""}. Now set FILE_STORAGE=firebase in the hosting settings and redeploy (ask the platform owner).`);
  });
  return (
    <Card title="File storage" action={<Button variant="ghost" disabled={a.busy} onClick={() => setReauth("test")}>Test now</Button>}>
      {!s ? <p className="text-sm text-muted">Loading…</p> : (
        <div className="space-y-2 text-sm">
          <p>Files are kept on <b>{s.provider === "cloudinary" ? "Cloudinary (free plan, private files)" : "Firebase Storage"}</b>.</p>
          {s.provider === "cloudinary" && <p className="text-xs text-muted">Free plan limits: 10 MB per file and a monthly allowance shared by storage and downloads. Evidence bundles larger than 9 MB are delivered in parts.</p>}
          {s.provider === "cloudinary" && s.firebaseBucket && (
            <div className="rounded-xl border border-line p-3">
              <p className="text-xs text-muted">Moving to Firebase Storage (needs the Blaze plan and a Storage bucket): copy every file across, then switch the setting. Files keep their paths, so nothing else changes.</p>
              <Button variant="soft" className="mt-2" disabled={a.busy} onClick={() => setReauth("copy")}>Copy all files to Firebase Storage</Button>
            </div>
          )}
          <ErrorText>{a.error}</ErrorText>{progress && <Notice>{progress}</Notice>}
        </div>
      )}
      {reauth && <div className="mt-3 rounded-xl border border-line p-3"><Reauth label={reauth === "copy" ? "Confirm and copy" : "Confirm and test"} onDone={() => { const r = reauth; setReauth(null); void (r === "copy" ? copy() : test()); }} /></div>}
    </Card>
  );
}

export function SystemTab() {
  const [info, setInfo] = useState<Info | null>(null);
  const [fresh, setFresh] = useState<"sync" | "export" | null>(null);
  const [results, setResults] = useState<{ step: string; ok: boolean; detail: string }[] | null>(null);
  const a = useAction();
  useEffect(() => { api<Info>("/api/system/heartbeat").then(setInfo).catch(() => undefined); }, []);

  async function download() {
    await a.run(async () => {
      const token = await auth().currentUser!.getIdToken();
      const res = await fetch("/api/export", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Export failed");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `lab-export-${new Date().toISOString().slice(0, 10)}.jsonl`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "Export downloaded");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <StorageCard />
      <Card title="Licence & version" action={<Button variant="ghost" disabled={a.busy} onClick={() => a.run(async () => setInfo(await api<Info>("/api/system/heartbeat", "POST")), "Checked with the Control Centre")}>Check now</Button>}>
        {!info ? <p className="text-sm text-muted">Loading…</p> : (
          <dl className="space-y-1 text-sm">
            <div>Status: <Badge tone={info.level === "ok" ? "ok" : info.level === "readonly" ? "warn" : "bad"}>{info.level === "ok" ? "Active" : info.level === "readonly" ? "Read-only" : "Locked"}</Badge> {info.reason && <span className="text-muted">{info.reason}</span>}</div>
            <div><span className="text-muted">Lab id:</span> {info.labId ?? "—"}</div>
            <div><span className="text-muted">Licence expires:</span> {info.expiresAt ? d(info.expiresAt) : "Never"}</div>
            <div><span className="text-muted">Last check with Control Centre:</span> {d(info.lastCheck)}</div>
            <div><span className="text-muted">App version:</span> {info.version} (build {info.build})</div>
          </dl>
        )}
      </Card>
      <Card title="Database rules & indexes">
        <p className="mb-3 text-sm text-muted">After an update that changes security rules or indexes, apply them here. Safe to run any time.</p>
        {fresh === "sync" ? <Reauth onDone={async () => { setFresh(null); await a.run(async () => setResults((await api<{ results: typeof results }>("/api/system/sync", "POST")).results), "Applied"); }} label="Confirm and apply" />
          : <Button variant="soft" onClick={() => setFresh("sync")}>Apply rules & indexes</Button>}
        {results && <ul className="mt-3 space-y-1 text-sm">{results.map((r) => <li key={r.step}><Badge tone={r.ok ? "ok" : "bad"}>{r.ok ? "✓" : "✗"}</Badge> {r.step}: <span className="text-muted">{r.detail}</span></li>)}</ul>}
      </Card>
      <Card title="Export all data" className="lg:col-span-2">
        <p className="mb-3 text-sm text-muted">Downloads every record of this lab (JSON lines, one record per line). Uploaded files are listed by their storage path. Works even when the app is read-only.</p>
        {fresh === "export" ? <Reauth onDone={async () => { setFresh(null); await download(); }} label="Confirm and download" />
          : <Button variant="ghost" onClick={() => setFresh("export")}>Export everything</Button>}
      </Card>
      <div className="lg:col-span-2"><ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice></div>
    </div>
  );
}
