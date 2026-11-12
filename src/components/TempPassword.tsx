"use client";
import { useState } from "react";
import { Button } from "./ui";

/** Shows a one-time temporary password for the supervisor to hand over securely. */
export function TempPassword({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-medium">Account ready. Share these sign-in details privately (shown only once):</p>
      <p>Email: <code className="select-all">{email}</code></p>
      <p>Temporary password: <code className="select-all rounded bg-white px-1 font-mono">{password}</code></p>
      <p className="text-xs text-muted">They must change it on first sign-in.</p>
      <Button variant="ghost" onClick={() => navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`).then(() => setCopied(true))}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
