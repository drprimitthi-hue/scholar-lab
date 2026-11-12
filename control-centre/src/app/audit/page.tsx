"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Card, ErrorText, Input, PageHeader, Spinner } from "@/components/ui";
import { Shell } from "@/components/Shell";

interface E { id: string; action: string; target: string; by: string; at: number; detail: unknown }
function Audit() {
  const [list, setList] = useState<E[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { api<{ entries: E[] }>("/api/audit").then((r) => setList(r.entries)).catch((e: Error) => setErr(e.message)); }, []);
  if (!list) return err ? <ErrorText>{err}</ErrorText> : <Spinner />;
  const rows = list.filter((e) => !q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="History" subtitle="Everything done in the Control Centre (last 500)." />
      <Card>
        <Input className="mb-4" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        <table className="w-full text-sm"><tbody>
          {rows.map((e) => <tr key={e.id} className="border-b border-line/60 last:border-0"><td className="py-2 pr-3 text-xs text-muted">{new Date(e.at).toLocaleString("en-GB")}</td><td className="pr-3"><code className="text-xs">{e.action}</code></td><td className="pr-3">{e.target}</td><td className="text-muted">{e.by}</td></tr>)}
        </tbody></table>
      </Card>
    </>
  );
}
export default function Page() { return <Shell><Audit /></Shell>; }
