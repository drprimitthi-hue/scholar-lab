"use client";
import Link from "next/link";
import { use } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useScholar } from "@/lib/client/data";
import { useSession } from "@/lib/client/session";
import { Badge, ErrorText, PageHeader, Spinner, Tabs } from "@/components/ui";
import { programmeName } from "@/components/scholar-bits";
import { Enrolment } from "@/components/scholar/Enrolment";
import { Degree } from "@/components/scholar/Degree";
import { Documents, LeaveHistory, PresenceHistory } from "@/components/scholar/Records";
import { Admin } from "@/components/scholar/Admin";
import { SeminarsTab } from "@/components/scholar/Seminars";
import { OutputsTab } from "@/components/scholar/Outputs";

export default function ScholarPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const s = useSession();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Each tab has its own link (e.g. /scholars/<id>?tab=degree) so it can be bookmarked or shared.
  const tab = search.get("tab") ?? "enrolment";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const { data, loading, error } = useScholar(uid);

  if (loading) return <Spinner />;
  if (!data) return <ErrorText>{error ?? "Scholar not found."}</ErrorText>;

  const tabs = [
    { id: "enrolment", label: "Enrolment" },
    { id: "degree", label: "Degree progress" },
    { id: "seminars", label: "Seminars & concepts" },
    { id: "outputs", label: "Outputs & prototypes" },
    { id: "presence", label: "Presence" },
    { id: "leave", label: "Leave" },
    { id: "documents", label: "Documents" },
    ...(s.role === "supervisor" ? [{ id: "admin", label: "Admin" }] : []),
  ];
  return (
    <>
      <PageHeader
        title={data.name}
        subtitle={`${programmeName(s.settings, data.programmeId)}${data.researchTopic ? ` · ${data.researchTopic}` : ""}`}
        action={<div className="flex items-center gap-3"><Link href={`/scholars/${uid}/report`} className="text-sm text-accent">Progress report</Link>{data.deletion ? <Badge tone="bad">Deletion scheduled</Badge> : <Badge tone="accent">{data.status}</Badge>}</div>}
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "enrolment" && <Enrolment key={data.updatedAt} scholar={data} />}
      {tab === "degree" && <Degree scholar={data} />}
      {tab === "seminars" && <SeminarsTab scholar={data} />}
      {tab === "outputs" && <OutputsTab scholar={data} />}
      {tab === "presence" && <PresenceHistory scholar={data} />}
      {tab === "leave" && <LeaveHistory scholar={data} />}
      {tab === "documents" && <Documents scholar={data} />}
      {tab === "admin" && s.role === "supervisor" && <Admin scholar={data} />}
    </>
  );
}
