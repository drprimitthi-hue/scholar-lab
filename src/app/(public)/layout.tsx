import Link from "next/link";
import { getInfo } from "@/lib/server/publicData";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/research", label: "Research" },
  { href: "/people", label: "People" },
  { href: "/publications", label: "Publications" },
  { href: "/news", label: "News" },
  { href: "/join", label: "Join us" },
  { href: "/contact", label: "Contact" },
];

export async function generateMetadata() {
  const info = await getInfo();
  return {
    title: { default: info.labName, template: `%s · ${info.labName}` },
    description: info.tagline || `${info.labName}${info.institution ? `, ${info.institution}` : ""}`,
    openGraph: { title: info.labName, description: info.tagline, type: "website" },
  };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const info = await getInfo();
  return (
    <div style={{ ["--accent" as string]: info.accent }} className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/" className="mr-auto leading-tight">
            {info.institution && <span className="block text-[11px] font-medium uppercase tracking-widest text-accent">{info.institution}</span>}
            <span className="block font-semibold">{info.labName}</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-2.5 py-1.5 text-muted hover:bg-canvas hover:text-ink">{n.label}</Link>)}
          </nav>
          <Link href="/login" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent">Member login</Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted">
          <div><p className="font-medium text-ink">{info.labName}</p><p>{[info.department, info.institution].filter(Boolean).join(", ")}</p></div>
          <div className="text-right">{info.contactEmail && <p>{info.contactEmail}</p>}{info.address && <p className="whitespace-pre-line">{info.address}</p>}</div>
        </div>
      </footer>
    </div>
  );
}
