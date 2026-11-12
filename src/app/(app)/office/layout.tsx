"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/lib/client/session";
import { Card } from "@/components/ui";

const LINKS = [
  { href: "/office", label: "Today" },
  { href: "/office/diary", label: "Diary" },
  { href: "/office/teaching", label: "Teaching" },
  { href: "/office/meetings", label: "Meetings" },
  { href: "/office/duties", label: "Duties" },
  { href: "/office/orders", label: "Office orders" },
  { href: "/office/records", label: "Records" },
  { href: "/office/cv", label: "CV" },
  { href: "/office/reports", label: "Reports" },
  { href: "/office/settings", label: "Office settings" },
];

/** My Office: the supervisor's private section. */
export default function OfficeLayout({ children }: { children: ReactNode }) {
  const s = useSession();
  const path = usePathname();
  if (s.role !== "supervisor") return <Card><p className="text-sm text-muted">This section is private to the supervisor.</p></Card>;
  const active = (h: string) => (h === "/office" ? path === "/office" : path.startsWith(h));
  return (
    <>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3 print:hidden" aria-label="My Office">
        {LINKS.map((l) => <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm ${active(l.href) ? "bg-accent text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}>{l.label}</Link>)}
      </nav>
      {children}
    </>
  );
}
