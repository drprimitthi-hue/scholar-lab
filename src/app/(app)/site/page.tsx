"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { ErrorText, PageHeader, Tabs } from "@/components/ui";
import { ContentEditor, ItemsEditor, PeopleEditor, SiteTools } from "@/components/site/Editor";

export default function SitePage() {
  const s = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "content";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  if (s.role !== "supervisor") return <ErrorText>Only the supervisor can edit the website.</ErrorText>;
  return (
    <>
      <PageHeader title="Lab website" subtitle="What the public sees. Projects are made public from each project's Edit form." />
      <Tabs tabs={[{ id: "content", label: "Content" }, { id: "news", label: "News" }, { id: "openings", label: "Open positions" }, { id: "publications", label: "Publications" }, { id: "people", label: "People" }, { id: "tools", label: "Tools" }]} value={tab} onChange={setTab} />
      {tab === "content" && <ContentEditor />}
      {tab === "news" && <ItemsEditor kind="news" />}
      {tab === "openings" && <ItemsEditor kind="openings" />}
      {tab === "publications" && <ItemsEditor kind="publications" />}
      {tab === "people" && <PeopleEditor />}
      {tab === "tools" && <SiteTools />}
    </>
  );
}
