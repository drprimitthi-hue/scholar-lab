"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOfficeSettings, useOrders } from "@/lib/client/office";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { OrderForm } from "@/components/office/Forms";

export default function OrdersPage() {
  const router = useRouter();
  const os = useOfficeSettings();
  const { data, loading } = useOrders();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const [add, setAdd] = useState(false);
  const years = [...new Set(data.map((o) => o.date.slice(0, 4)))].sort().reverse();
  const list = data.filter((o) => (!type || o.type === type) && (!year || o.date.startsWith(year)) && (!q || `${o.number} ${o.title} ${o.mention} ${o.issuedBy}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader title="Office orders" subtitle={`${list.length} order(s)`} action={<Button onClick={() => setAdd(true)}>Add order</Button>} />
      <Card className="mb-5"><div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search number, title, responsibility…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{[...new Set([...os.orderTypes, ...data.map((o) => o.type).filter(Boolean)])].map((t) => <option key={t}>{t}</option>)}</Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</Select>
      </div></Card>
      {loading ? <Spinner /> : !list.length ? <Card><Empty>No orders recorded.</Empty></Card> : (
        <Card><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Date</th><th>Number</th><th>Title</th><th>Type</th><th>Files</th></tr></thead>
          <tbody>{list.map((o) => (
            <tr key={o.id} className="border-t border-line/60 align-top">
              <td className="whitespace-nowrap py-2">{formatDate(o.date)}</td>
              <td className="whitespace-nowrap">{o.number}</td>
              <td><Link href={`/office/orders/${o.id}`} className="font-medium hover:text-accent">{o.title}</Link>{o.mention && <p className="line-clamp-1 text-xs text-muted">{o.mention}</p>}</td>
              <td>{o.type && <Badge>{o.type}</Badge>}</td>
              <td>{o.files.length || ""}</td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
      <Modal open={add} onClose={() => setAdd(false)} title="Add office order">{add && <OrderForm onDone={(id) => { setAdd(false); router.push(`/office/orders/${id}`); }} />}</Modal>
    </>
  );
}
