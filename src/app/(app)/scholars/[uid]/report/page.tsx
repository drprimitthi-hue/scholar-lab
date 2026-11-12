"use client";
import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ScholarReportView } from "@/components/report/ScholarReportView";

export default function ScholarReportPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  return (
    <>
      <div className="print:hidden"><PageHeader title="Progress report" action={<Link href={`/scholars/${uid}`} className="text-sm text-muted">Back to record</Link>} /></div>
      <ScholarReportView uid={uid} />
    </>
  );
}
