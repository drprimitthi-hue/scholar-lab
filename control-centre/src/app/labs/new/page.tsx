"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/ui";
import { LabForm } from "@/components/LabForm";
import { Shell } from "@/components/Shell";

export default function Page() {
  const router = useRouter();
  return (
    <Shell>
      <PageHeader title="Add lab" subtitle="Register a faculty member's lab. You can issue the licence on the next page." />
      <LabForm withId onSave={async (body) => { const r = await api<{ id: string }>("/api/labs", "POST", body); router.push(`/labs/${r.id}`); }} />
    </Shell>
  );
}
