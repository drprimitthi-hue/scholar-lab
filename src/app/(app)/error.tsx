"use client";
import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

/** Friendly message instead of a blank page; the details stay in the browser console (never shown to users). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Card title="Something went wrong on this page">
      <p className="text-sm text-muted">Your data is safe; nothing was changed by this error. Try again, or go back and reopen the page.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-4 flex gap-2"><Button onClick={reset}>Try again</Button><Button variant="ghost" onClick={() => history.back()}>Go back</Button></div>
    </Card>
  );
}
