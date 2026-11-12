"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Badge, Button, Card, Empty, ErrorText, Notice, PageHeader, Spinner, useAction } from "@/components/ui";
import { Reauth } from "@/components/Reauth";
import { Shell } from "@/components/Shell";

interface R { mainSha: string; stableSha: string | null; ahead: number | null; behind?: number | null; commits: { sha: string; message: string; date: string }[]; ci?: "passed" | "failed" | "running" | "none" | "unknown" }

function Releases() {
  const [r, setR] = useState<R | null>(null);
  const [confirm, setConfirm] = useState(false);
  const a = useAction();
  const load = () => api<R>("/api/releases").then(setR).catch((e: Error) => a.setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  if (!r) return a.error ? <ErrorText>{a.error}</ErrorText> : <Spinner />;
  return (
    <>
      <PageHeader title="Releases" subtitle="Your lab runs the latest code (main). All other labs run the released version (stable)." />
      <Card title="Waiting to be released" action={<Badge tone={r.ahead ? "warn" : "ok"}>{r.stableSha === null ? "stable not created yet" : r.ahead ? `${r.ahead} change(s)` : "Up to date"}</Badge>}>
        {r.ci && <p className="mb-3 text-sm">Automatic checks for the latest version: <Badge tone={r.ci === "passed" ? "ok" : r.ci === "failed" ? "bad" : "warn"}>{{ passed: "passed", failed: "failed", running: "running", none: "not run yet", unknown: "unknown" }[r.ci]}</Badge>{r.ci !== "passed" && <span className="ml-2 text-xs text-muted">Releasing is possible only after they pass.</span>}</p>}
        {!r.commits.length && r.stableSha !== null ? <Empty>All labs have the latest version.</Empty> : (
          <ul className="mb-4 divide-y divide-line/60 text-sm">{r.commits.map((c) => <li key={c.sha} className="flex justify-between gap-3 py-2"><span>{c.message}</span><span className="text-xs text-muted">{c.sha} · {new Date(c.date).toLocaleDateString("en-GB")}</span></li>)}</ul>
        )}
        <p className="mb-3 text-sm text-muted">Release only after testing on your own lab. Vercel then rebuilds every lab that follows <code>stable</code> (a few minutes each). After a release that changes database rules, each lab&apos;s supervisor clicks Settings → System → &quot;Apply rules &amp; indexes&quot;.</p>
        {confirm ? <Reauth label="Confirm release" onDone={async () => { setConfirm(false); await a.run(() => api("/api/releases", "POST"), "Released"); load(); }} />
          : <Button disabled={a.busy || (r.stableSha !== null && !r.ahead) || r.ci !== "passed"} onClick={() => setConfirm(true)}>Release to all labs</Button>}
        <div className="mt-3"><ErrorText>{a.error}</ErrorText><Notice>{a.done}</Notice></div>
      </Card>
    </>
  );
}
export default function Page() { return <Shell><Releases /></Shell>; }
