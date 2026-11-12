"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/client/session";
import { Button, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Labs" },
  { href: "/labs/new", label: "Add lab" },
  { href: "/releases", label: "Releases" },
  { href: "/audit", label: "History" },
  { href: "/account/security", label: "Security" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const s = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (s.loading) return;
    if (!s.user) router.replace("/login");
    else if (s.admin && !s.mfa && path !== "/account/security") router.replace("/account/security");
  }, [s, path, router]);
  if (s.loading || !s.user) return <Spinner />;
  if (!s.admin) return <main className="p-10 text-center"><p className="mb-4">This account has no access.</p><Button variant="ghost" onClick={() => s.logout()}>Sign out</Button></main>;
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-6 py-3">
        <span className="mr-4 font-semibold">Control Centre</span>
        {s.mfa && NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-1.5 text-sm ${(n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-canvas"}`}>{n.label}</Link>
        ))}
        <span className="ml-auto text-sm text-muted">{s.user.email}</span>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => s.logout()}>Sign out</Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
