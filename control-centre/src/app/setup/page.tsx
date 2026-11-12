"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { passwordProblem } from "@/lib/password";
import { Button, Card, ErrorText, Field, Input, Spinner, useAction } from "@/components/ui";

export default function Setup() {
  const [st, setSt] = useState<{ setupDone: boolean; tokenConfigured: boolean; keysConfigured: boolean } | null>(null);
  const [keys, setKeys] = useState<{ privateKey: string; publicKey: string } | null>(null);
  const [f, setF] = useState({ setupToken: "", email: "", password: "", confirm: "" });
  const [done, setDone] = useState(false);
  const a = useAction();
  const [loadError, setLoadError] = useState(false);
  useEffect(() => { fetch("/api/setup", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); setSt(await r.json()); }).catch(() => setLoadError(true)); }, []);
  if (loadError) return <main className="mx-auto max-w-md p-10 text-sm">Could not reach the database. Check the Firebase project and environment variables, then reload.</main>;
  if (!st) return <Spinner />;
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Control Centre setup</h1>
      <Card>
        {st.setupDone || done ? <p className="text-sm">Setup is complete. <Link href="/login" className="text-accent">Sign in →</Link> (you will set up the authenticator app first).</p>
          : !st.tokenConfigured ? <p className="text-sm">Set SETUP_TOKEN in the environment variables first.</p>
          : !st.keysConfigured ? (
            <div className="space-y-3 text-sm">
              <p><b>Step 1 — licence keys.</b> Generate a key pair, add both values to this project&apos;s Vercel environment variables (mark them Sensitive), redeploy, then reload this page.</p>
              {!keys ? <Button onClick={() => a.run(async () => { const r = await fetch("/api/setup/keys", { method: "POST" }); if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); setKeys(await r.json()); })}>Generate keys</Button> : (
                <div className="space-y-2">
                  {(["LICENCE_PRIVATE_KEY", "LICENCE_PUBLIC_KEY"] as const).map((k) => (
                    <div key={k}><p className="font-mono text-xs font-medium">{k}</p><textarea readOnly rows={3} className="w-full rounded border border-line p-2 font-mono text-xs" value={k === "LICENCE_PRIVATE_KEY" ? keys.privateKey : keys.publicKey} onFocus={(e) => e.currentTarget.select()} /></div>
                  ))}
                  <p className="text-xs text-bad">Copy them now — the private key is not shown again. Never share the private key.</p>
                </div>
              )}
              <ErrorText>{a.error}</ErrorText>
            </div>
          )
          : (
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              if (f.password.length < 12 || passwordProblem(f.password)) return a.setError("Use at least 12 characters with upper, lower case and a number.");
              if (f.password !== f.confirm) return a.setError("Passwords do not match.");
              await a.run(async () => {
                const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupToken: f.setupToken, email: f.email, password: f.password }) });
                if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
                setDone(true);
              });
            }}>
              <Field label="Setup code (SETUP_TOKEN)"><Input required value={f.setupToken} onChange={(e) => setF({ ...f, setupToken: e.target.value.trim() })} /></Field>
              <Field label="Your email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Password (12+ characters)"><Input type="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
              <Field label="Confirm"><Input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
              <ErrorText>{a.error}</ErrorText>
              <Button type="submit" disabled={a.busy} className="w-full">Create administrator</Button>
            </form>
          )}
      </Card>
    </main>
  );
}
