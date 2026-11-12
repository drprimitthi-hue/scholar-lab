"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { passwordProblem } from "@/lib/domain/password";
import { Badge, Button, Card, ErrorText, Field, Input, Spinner, useAction } from "@/components/ui";

interface Step { step: string; ok: boolean; detail: string }

export default function SetupPage() {
  const [state, setState] = useState<{ setupDone: boolean; tokenConfigured: boolean } | null>(null);
  const [f, setF] = useState({ setupToken: "", labName: "", institution: "", name: "", email: "", password: "", confirm: "" });
  const [result, setResult] = useState<{ done: boolean; results: Step[] } | null>(null);
  const a = useAction();
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); setState(await r.json()); }).catch(() => setLoadError(true));
  }, []);
  if (loadError) return <main className="mx-auto max-w-md p-10 text-sm">Could not reach the database. Check that the Firebase project, Firestore database and the environment variables are set up, then reload.</main>;
  if (!state) return <Spinner />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblem(f.password);
    if (p) return a.setError(p);
    if (f.password !== f.confirm) return a.setError("The passwords do not match.");
    await a.run(async () => {
      const { confirm: _c, ...body } = f;
      void _c;
      const res = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? "Setup failed");
      setResult(data);
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Set up your lab</h1>
      <p className="mt-1 mb-6 text-sm text-muted">This page works once. It secures the database, creates your supervisor account and default settings.</p>
      {state.setupDone && !result ? (
        <Card><p className="text-sm">This lab is already set up. <Link href="/login" className="text-accent">Sign in →</Link></p></Card>
      ) : !state.tokenConfigured ? (
        <Card><p className="text-sm">Setup is not available yet: the setup code has not been configured for this site. Please contact the platform administrator.</p></Card>
      ) : result ? (
        <Card title={result.done ? "Your lab is ready" : "Some steps need attention"}>
          <ul className="space-y-3">
            {result.results.map((r) => (
              <li key={r.step} className="text-sm">
                <div className="flex items-center gap-2"><Badge tone={r.ok ? "ok" : "bad"}>{r.ok ? "✓ Done" : "✗ Not done"}</Badge><span className="font-medium">{r.step}</span></div>
                <p className="mt-1 text-muted">{r.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {result.done ? <Link href="/login" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Sign in</Link> : <Button onClick={() => setResult(null)}>Fix and run again</Button>}
          </div>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Setup code (from the platform administrator)"><Input required value={f.setupToken} onChange={(e) => setF({ ...f, setupToken: e.target.value.trim() })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lab name"><Input required value={f.labName} onChange={(e) => setF({ ...f, labName: e.target.value })} /></Field>
              <Field label="Institution"><Input value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} /></Field>
            </div>
            <Field label="Your full name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Your email (used to sign in)"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Choose a password" hint="10+ characters, upper & lower case and a number"><Input type="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
              <Field label="Confirm password"><Input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
            </div>
            <ErrorText>{a.error}</ErrorText>
            <Button type="submit" disabled={a.busy} className="w-full">{a.busy ? "Setting up… (about a minute)" : "Set up my lab"}</Button>
          </form>
        </Card>
      )}
    </main>
  );
}
