"use client";
import { useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { fs } from "@/lib/client/firebase";
import { useLiveQuery } from "@/lib/client/hooks";
import { useUsers } from "@/lib/client/data";
import type { AuditEntry } from "@/lib/types";
import { Card, ErrorText, Input, PageHeader, Select, Spinner } from "@/components/ui";

export default function AuditPage() {
  const [n, setN] = useState(200);
  const { data, loading, error } = useLiveQuery<AuditEntry & { id: string }>(() => query(collection(fs(), "auditLog"), orderBy("at", "desc"), limit(n)), `audit:${n}`);
  const users = useUsers();
  const names = new Map(users.data.map((u) => [u.uid, u.name]));
  const [q, setQ] = useState("");
  const list = data.filter((e) => !q || `${e.action} ${e.targetId} ${names.get(e.actorUid) ?? e.actorUid}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change is recorded here and cannot be edited." />
      <Card>
        <div className="mb-4 flex gap-3"><Input placeholder="Filter by action, person or record…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="w-36" value={n} onChange={(e) => setN(Number(e.target.value))}>{[200, 500, 1000].map((x) => <option key={x} value={x}>Last {x}</option>)}</Select></div>
        <ErrorText>{error}</ErrorText>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">When</th><th className="pr-3">Who</th><th className="pr-3">Action</th><th className="pr-3">Record</th><th>Change</th></tr></thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-line/60 align-top last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">{new Date(e.at).toLocaleString("en-GB")}</td>
                    <td className="pr-3">{names.get(e.actorUid) ?? e.actorUid}<div className="text-xs text-muted">{e.actorRole}</div></td>
                    <td className="pr-3 font-mono text-xs">{e.action}</td>
                    <td className="pr-3 text-xs text-muted">{e.targetType}<br />{names.get(e.targetId) ?? e.targetId}</td>
                    <td className="max-w-md text-xs">
                      {e.after != null && <details><summary className="cursor-pointer text-accent">details</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-canvas p-2">{JSON.stringify({ before: e.before, after: e.after }, null, 2)}</pre></details>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
