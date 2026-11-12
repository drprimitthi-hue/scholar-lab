"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMultiFactorResolver,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { useSession } from "@/lib/client/session";
import { Button, Card, ErrorText, Field, Input, Notice, useAction } from "@/components/ui";

function friendly(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(code)) return "Incorrect email or password.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "auth/user-disabled") return "This account is disabled. Please contact your supervisor.";
  if (code === "auth/invalid-verification-code") return "That code is not correct.";
  return "Sign-in failed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const a = useAction();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      try {
        if (resolver) {
          const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
          if (!hint) throw new Error("No authenticator app is set up for this account.");
          await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim()));
        } else {
          await signInWithEmailAndPassword(auth(), email.trim(), password);
        }
      } catch (err) {
        if ((err as { code?: string }).code === "auth/multi-factor-auth-required") {
          setResolver(getMultiFactorResolver(auth(), err as MultiFactorError));
          return;
        }
        throw new Error(friendly(err));
      }
    });
  }

  async function reset() {
    if (!email) return a.setError("Enter your email first.");
    await a.run(async () => {
      await sendPasswordResetEmail(auth(), email.trim()).catch(() => undefined);
    }, "If an account exists for this email, a reset link has been sent.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Member sign-in</h1>
        <p className="mb-6 text-sm text-muted">{resolver ? "Enter the 6-digit code from your authenticator app." : "Accounts are created by the lab supervisor."}</p>
        <form onSubmit={submit} className="space-y-4">
          {!resolver ? (
            <>
              <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            </>
          ) : (
            <Field label="Authenticator code">
              <Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          )}
          <ErrorText>{a.error}</ErrorText>
          <Notice>{a.done}</Notice>
          <Button type="submit" className="w-full" disabled={a.busy}>{a.busy ? "Please wait…" : resolver ? "Verify" : "Sign in"}</Button>
          {!resolver && (
            <button type="button" onClick={reset} className="w-full text-center text-sm text-muted hover:text-accent">Forgot password?</button>
          )}
        </form>
      </Card>
    </main>
  );
}
