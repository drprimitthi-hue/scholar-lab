"use client";
import { useState } from "react";
import { multiFactor, TotpMultiFactorGenerator, type TotpSecret } from "firebase/auth";
import QRCode from "qrcode";
import { auth } from "@/lib/client/firebase";
import { useSession } from "@/lib/client/session";
import { Reauth } from "@/components/Reauth";
import { Badge, Button, Card, ErrorText, Field, Input, PageHeader, useAction } from "@/components/ui";
import { Shell } from "@/components/Shell";

export default function Page() {
  return <Shell><SecurityPage /></Shell>;
}

function SecurityPage() {
  const s = useSession();
  const u = auth().currentUser;
  const factors = u ? multiFactor(u).enrolledFactors : [];
  const required = true;
  const [step, setStep] = useState<"idle" | "reauth" | "scan" | "done">("idle");
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const a = useAction();

  async function startEnrol() {
    await a.run(async () => {
      const session = await multiFactor(auth().currentUser!).getSession();
      const sec = await TotpMultiFactorGenerator.generateSecret(session);
      setSecret(sec);
      setQr(await QRCode.toDataURL(sec.generateQrCodeUrl(auth().currentUser!.email ?? "account", "Lab Control Centre"), { margin: 1, width: 220 }));
      setStep("scan");
    });
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    const ok = await a.run(async () => {
      if (!secret) return;
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(auth().currentUser!).enroll(assertion, "Authenticator app");
    });
    if (ok) setStep("done");
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Sign-in security" subtitle={required ? "Two-factor sign-in is required for your role." : "Two-factor sign-in is optional but recommended."} />
      <Card title="Two-factor authentication (authenticator app)">
        {factors.length > 0 && step !== "done" && (
          <div className="mb-4 space-y-2">
            {factors.map((f) => (
              <div key={f.uid} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span>{f.displayName ?? "Authenticator"} · added {new Date(f.enrollmentTime).toLocaleDateString("en-GB")}</span>
                <Badge tone="ok">Active</Badge>
              </div>
            ))}
            {required && !s.mfa && <p className="text-sm text-warn">Sign out and sign in again with your authenticator code to continue.</p>}
          </div>
        )}

        {step === "idle" && (
          <Button onClick={() => setStep("reauth")}>{factors.length ? "Add another authenticator" : "Set up authenticator app"}</Button>
        )}
        {step === "reauth" && (
          <>
            <p className="mb-3 text-sm text-muted">Confirm it&apos;s you before setting up.</p>
            <Reauth onDone={startEnrol} label="Continue" />
            <ErrorText>{a.error}</ErrorText>
          </>
        )}
        {step === "scan" && secret && (
          <form onSubmit={finish} className="space-y-4">
            <p className="text-sm">Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.).</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Authenticator QR code" width={220} height={220} className="rounded-lg border border-line" />
            <p className="text-xs text-muted">Can&apos;t scan? Enter this key manually: <code className="select-all break-all rounded bg-canvas px-1">{secret.secretKey}</code></p>
            <Field label="6-digit code from the app"><Input inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <ErrorText>{a.error}</ErrorText>
            <Button type="submit" disabled={a.busy}>Verify and turn on</Button>
          </form>
        )}
        {step === "done" && (
          <div className="space-y-3">
            <p className="text-sm text-ok">Two-factor sign-in is now on.</p>
            <p className="text-sm">Please sign out and sign in again using your authenticator code to continue.</p>
            <Button onClick={() => s.logout()}>Sign out now</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
