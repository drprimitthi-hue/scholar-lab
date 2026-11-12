import Link from "next/link";
import type { ReactNode } from "react";

const TITLES = /^(dr|prof|mr|mrs|ms|shri|smt)\.?$/i;
export const initials = (n: string) =>
  n.split(/\s+/).filter((w) => w && !TITLES.test(w)).filter((_, i, a) => i === 0 || i === a.length - 1).map((x) => x[0]!.toUpperCase()).join("") || "?";
export const fmtDate = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");

export function Section({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      {(title || action) && <div className="mb-6 flex items-end justify-between gap-4">{title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {lead && <p className="mt-3 max-w-3xl text-lg text-muted">{lead}</p>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent" style={{ width: size, height: size, fontSize: size / 2.8 }} aria-hidden>
      {initials(name)}
    </div>
  );
}

export function More({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-sm font-medium text-accent hover:underline">{children} →</Link>;
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return /^https?:\/\//.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{children}</a> : <>{children}</>;
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{children}</p>;
