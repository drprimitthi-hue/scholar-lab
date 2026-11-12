"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { passwordProblem } from "@/lib/domain/password";
import { Reauth } from "@/components/Reauth";
import { Button, Card, ErrorText, Field, Input, PageHeader, useAction } from "@/components/ui";

export default function PasswordPage() {
  const s = useSession();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const a = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(next);
    if (problem) return a.setError(problem);
    if (next !== confirm) return a.setError("The two new passwords do not match.");
    const ok = await a.run(async () => {
      await updatePassword(auth().currentUser!, next);
      await api("/api/me/password-changed", "POST");
      await s.refresh();
    });
    if (ok) router.replace("/dashboard");
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Set your password" subtitle={s.profile?.mustChangePassword ? "Please replace the temporary password before continuing." : "Change your password."} />
      <Card>
        {!verified ? (
          <>
            <p className="mb-4 text-sm text-muted">First confirm your current {s.profile?.mustChangePassword ? "temporary " : ""}password.</p>
            <Reauth onDone={() => setVerified(true)} label="Continue" />
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="New password" hint="At least 10 characters with upper-case, lower-case and a number."><Input type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} /></Field>
            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
            <ErrorText>{a.error}</ErrorText>
            <Button type="submit" disabled={a.busy}>{a.busy ? "Saving…" : "Save password"}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
