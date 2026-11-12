"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDuties, useOrders } from "@/lib/client/office";
import { formatDate } from "@/lib/domain/dates";
import { Badge, Button, Card, ErrorText, Modal, PageHeader, Spinner } from "@/components/ui";
import { DutyForm, OrderForm } from "@/components/office/Forms";
import { Cats, FileList } from "@/components/office/bits";

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const orders = useOrders();
  const duties = useDuties();
  const [edit, setEdit] = useState(false);
  const [duty, setDuty] = useState(false);
  if (orders.loading) return <Spinner />;
  const o = orders.data.find((x) => x.id === id);
  if (!o) return <ErrorText>Order not found.</ErrorText>;
  const linked = duties.data.filter((d) => d.source.type === "order" && d.source.id === id);
  return (
    <>
      <PageHeader title={o.title} subtitle={`${o.number ? `${o.number} · ` : ""}${formatDate(o.date)}${o.type ? ` · ${o.type}` : ""}`}
        action={<div className="flex gap-2"><Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button>
          <Button variant="ghost" className="text-bad" onClick={async () => { if (confirm("Delete this order record?")) { try { await api(`/api/office/orders/${id}`, "DELETE"); router.push("/office/orders"); } catch (e) { alert((e as Error).message); } } }}>Delete</Button></div>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <dl className="space-y-2 text-sm">
            {o.issuedBy && <div><dt className="text-xs text-muted">Issued by</dt><dd>{o.issuedBy}</dd></div>}
            {o.mention && <div><dt className="text-xs text-muted">My responsibility / mention</dt><dd className="whitespace-pre-wrap">{o.mention}</dd></div>}
            {(o.validFrom || o.validTo) && <div><dt className="text-xs text-muted">Valid</dt><dd>{o.validFrom ? formatDate(o.validFrom) : "…"} – {o.validTo ? formatDate(o.validTo) : "until further orders"}</dd></div>}
            {o.categories.length > 0 && <div><dt className="text-xs text-muted">Categories</dt><dd><Cats list={o.categories} /></dd></div>}
          </dl>
        </Card>
        <div className="space-y-5">
          <Card title="Order copy"><FileList files={o.files} />{!o.files.length && <p className="text-sm text-muted">No file attached.</p>}</Card>
          <Card title="Duties from this order" action={<Button variant="soft" onClick={() => setDuty(true)}>Add duty</Button>}>
            {!linked.length ? <p className="text-sm text-muted">None.</p> : <ul className="space-y-1 text-sm">{linked.map((d) => <li key={d.id} className="flex justify-between gap-2"><Link href={`/office/duties?id=${d.id}`} className="hover:text-accent">{d.title}</Link><Badge tone={d.status === "done" ? "ok" : "warn"}>{d.status === "done" ? "done" : d.deadline ? formatDate(d.deadline) : "open"}</Badge></li>)}</ul>}
          </Card>
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit order">{edit && <OrderForm o={o} onDone={() => setEdit(false)} />}</Modal>
      <Modal open={duty} onClose={() => setDuty(false)} title="New duty">{duty && <DutyForm source={{ type: "order", id, label: `${o.number || "Order"}: ${o.title}`.slice(0, 300) }} onDone={() => setDuty(false)} />}</Modal>
    </>
  );
}
