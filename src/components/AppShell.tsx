"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/client/session";
import { Button, Modal, Spinner } from "@/components/ui";
import { QuickDiary } from "@/components/office/Diary";
import type { Role } from "@/lib/types";

const NAV: Record<Role, { href: string; label: string }[]> = {
  supervisor: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/scholars", label: "Scholars" },
    { href: "/projects", label: "Projects" },
    { href: "/review", label: "Review queue" },
    { href: "/seminars", label: "Seminars" },
    { href: "/outputs", label: "Outputs" },
    { href: "/office", label: "My Office" },
    { href: "/reports", label: "Lab report" },
    { href: "/site", label: "Lab website" },
    { href: "/accounts", label: "Accounts" },
    { href: "/presence", label: "Presence" },
    { href: "/leave", label: "Leave" },
    { href: "/settings", label: "Settings" },
    { href: "/audit", label: "Audit log" },
    { href: "/account/security", label: "Security" },
  ],
  mentor: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/scholars", label: "My scholars" },
    { href: "/projects", label: "Projects" },
    { href: "/review", label: "Review queue" },
    { href: "/seminars", label: "Seminars" },
    { href: "/outputs", label: "Outputs" },
    { href: "/presence", label: "Presence" },
    { href: "/leave", label: "Leave" },
    { href: "/account/security", label: "Security" },
  ],
  scholar: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/reading", label: "Today's reading" },
    { href: "/projects", label: "My projects" },
    { href: "/seminars", label: "Seminars" },
    { href: "/outputs", label: "My outputs" },
    { href: "/me", label: "My record" },
    { href: "/presence", label: "Presence" },
    { href: "/leave", label: "Leave" },
    { href: "/account/security", label: "Security" },
  ],
  alumni: [
    { href: "/me", label: "My record" },
    { href: "/outputs", label: "My outputs" },
    { href: "/account/security", label: "Security" },
  ],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const s = useSession();
  const router = useRouter();
  const path = usePathname();
  const [diary, setDiary] = useState(false);

  const needsPassword = Boolean(s.profile?.mustChangePassword);
  const needsMfa = (s.role === "supervisor" || s.role === "mentor") && !s.mfa;

  useEffect(() => {
    if (s.loading) return;
    if (!s.user) router.replace("/login");
    else if (needsPassword && path !== "/account/password") router.replace("/account/password");
    else if (!needsPassword && needsMfa && path !== "/account/security") router.replace("/account/security");
  }, [s.loading, s.user, needsPassword, needsMfa, path, router]);

  if (s.loading || !s.user) return <Spinner />;
  if (!s.active || !s.role)
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <p className="mb-4">This account is not active. Please contact your supervisor.</p>
        <Button variant="ghost" onClick={() => s.logout()}>Sign out</Button>
      </main>
    );

  if (s.licence?.level === "locked")
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="mb-2 text-xl font-semibold">This lab app is not available</h1>
        <p className="mb-6 text-sm text-muted">{s.licence.reason || "The licence is not active."} Your records are safe. Please contact the platform administrator.</p>
        <Button variant="ghost" onClick={() => s.logout()}>Sign out</Button>
      </main>
    );

  const nav = needsPassword || needsMfa ? [] : NAV[s.role];
  return (
    <div className="min-h-screen md:flex print:block">
      <aside className="border-b border-line bg-surface md:min-h-screen md:w-60 md:border-b-0 md:border-r print:hidden">
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">{s.settings.institution || "Lab"}</p>
          <p className="mt-1 font-semibold leading-tight">{s.settings.labName}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map((n) => {
            const on = path === n.href || (n.href !== "/dashboard" && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${on ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-canvas"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-surface/70 px-6 py-3 backdrop-blur print:hidden">
          {s.role === "supervisor" && <Button className="mr-auto px-3 py-1.5" onClick={() => setDiary(true)}>+ Diary</Button>}
          <span className="text-sm text-muted">{s.profile?.name ?? s.user.email}</span>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs capitalize text-muted">{s.role}</span>
          <Button variant="ghost" className="px-3 py-1.5" onClick={() => s.logout()}>Sign out</Button>
        </header>
        {s.licence?.level === "readonly" && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-warn">
            Read-only: {s.licence.reason} {s.role === "supervisor" && "You can still view and export everything (Settings → System)."}
          </div>
        )}
        <main className="mx-auto max-w-6xl px-6 py-8 print:max-w-none print:p-0">{children}</main>
        {s.role === "supervisor" && <Modal open={diary} onClose={() => setDiary(false)} title="Add to diary">{diary && <QuickDiary compact />}</Modal>}
      </div>
    </div>
  );
}
