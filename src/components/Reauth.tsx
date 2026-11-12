"use client";
import { useState } from "react";
import {
  EmailAuthProvider,
  getMultiFactorResolver,
  reauthenticateWithCredential,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { Button, ErrorText, Field, Input, useAction } from "./ui";

/** Confirms identity again (password, then authenticator code if enrolled). Calls onDone when the session is fresh. */
export function Reauth({ onDone, label = "Confirm" }: { onDone: () => void; label?: string }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const a = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await a.run(async () => {
      const u = auth().currentUser!;
      try {
        if (resolver) {
          const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
          if (!hint) throw new Error("No authenticator found");
          await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim()));
        } else {
          await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email!, password));
        }
      } catch (err) {
        if ((err as { code?: string }).code === "auth/multi-factor-auth-required") {
          setResolver(getMultiFactorResolver(auth(), err as MultiFactorError));
          throw new Error("Now enter the code from your authenticator app.");
        }
        if (err instanceof Error && err.message === "No authenticator found") throw err;
        throw new Error(resolver ? "That code is not correct." : "Password is incorrect.");
      }
    });
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!resolver ? (
        <Field label="Your password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      ) : (
        <Field label="Authenticator code"><Input inputMode="numeric" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      )}
      <ErrorText>{a.error}</ErrorText>
      <Button type="submit" disabled={a.busy}>{a.busy ? "Checking…" : label}</Button>
    </form>
  );
}
