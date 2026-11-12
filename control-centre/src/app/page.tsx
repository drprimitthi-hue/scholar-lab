"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { labAlerts } from "@/lib/alerts";
import { toCsv } from "@/lib/csv";
import type { Lab } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { Shell } from "@/components/Shell";

const d = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleDateString("en-GB") : "—");

function Labs() {
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [stable, setStable] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  useEffect(() => {
    api<{ labs: Lab[] }>("/api/labs").then((r) => setLabs(r.labs)).catch((e: Error) => setErr(e.message));
    api<{ stableSha: string | null }>("/api/releases").then((r) => setStable(r.stableSha)).catch(() => undefined);
  }, []);
  if (!labs) return err ? <ErrorText>{err}</ErrorText> : <Spinner />;
  const now = Date.now();
  const list = labs.filter((l) => (!st || l.status === st) && (!q || JSON.stringify([l.labName, l.faculty, l.domains]).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.labName.localeCompare(b.labName));
  const exportCsv = () => {
    const csv = toCsv(["Lab id", "Lab", "Faculty", "Designation", "Department", "Institution", "Email", "Phone", "Joined", "Status", "Licence expires", "Last check-in", "Version", "Site"],
      list.map((l) => [l.id, l.labName, l.faculty.name, l.faculty.designation, l.faculty.department, l.faculty.institution, l.faculty.email, l.faculty.phone, l.joinedOn, l.status, l.licence ? (l.licence.exp ? d(l.licence.exp) : "never") : "none", d(l.lastHeartbeat?.at), l.lastHeartbeat?.version ?? "", l.siteUrl]));
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "labs.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const counts = { active: labs.filter((l) => l.status === "active").length, attention: labs.filter((l) => labAlerts(l, now, stable).some((x) => x.tone !== "neutral")).length };
  return (
    <>
      <PageHeader title="Labs" subtitle={`${labs.length} registered · ${counts.active} active · ${counts.attention} need attention`} action={<div className="flex gap-2"><Button variant="ghost" onClick={exportCsv}>Export CSV</Button><Link href="/labs/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Add lab</Link></div>} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search lab, faculty, institution, domain…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></Select>
        </div>
        {!list.length ? <Empty>No labs yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">Lab / faculty</th><th className="pr-3">Institution</th><th className="pr-3">Joined</th><th className="pr-3">Licence</th><th className="pr-3">Last check-in</th><th>Attention</th></tr></thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id} className="border-b border-line/60 align-top last:border-0">
                    <td className="py-2.5 pr-3"><Link href={`/labs/${l.id}`} className="font-medium hover:text-accent">{l.labName}</Link><div className="text-xs text-muted">{l.faculty.name}{l.faculty.designation && `, ${l.faculty.designation}`}</div></td>
                    <td className="pr-3">{l.faculty.institution}<div className="text-xs text-muted">{l.faculty.department}</div></td>
                    <td className="pr-3">{l.joinedOn || "—"}</td>
                    <td className="pr-3"><Badge tone={l.status === "active" ? "ok" : l.status === "suspended" ? "warn" : "bad"}>{l.status}</Badge><div className="text-xs text-muted">{l.licence ? (l.licence.exp ? `until ${d(l.licence.exp)}` : "no expiry") : "not issued"}</div></td>
                    <td className="pr-3">{d(l.lastHeartbeat?.at)}<div className="text-xs text-muted">{l.lastHeartbeat?.version}</div></td>
                    <td className="space-y-1">{labAlerts(l, now, stable).map((x) => <div key={x.text}><Badge tone={x.tone}>{x.text}</Badge></div>)}</td>
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

export default function Page() {
  return <Shell><Labs /></Shell>;
}
