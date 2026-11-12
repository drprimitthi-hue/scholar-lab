"use client";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { CvDocument, useCvData } from "@/components/office/Cv";

export default function CvPrint() {
  const { profile, sections, loading } = useCvData();
  if (loading) return <Spinner />;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-canvas p-3 text-sm print:hidden">
        <span className="text-muted">Use your browser’s print dialog and choose “Save as PDF”.</span>
        <div className="flex gap-2"><Link href="/office/cv" className="self-center text-muted">Back</Link><Button onClick={() => window.print()}>Print / save as PDF</Button></div>
      </div>
      <CvDocument profile={profile} sections={sections} />
    </>
  );
}
