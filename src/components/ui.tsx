"use client";
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    soft: "bg-accent/10 text-accent hover:bg-accent/15",
    ghost: "bg-white border border-line text-ink hover:bg-canvas",
    danger: "bg-bad text-white hover:opacity-90",
  }[variant];
  return <button {...p} className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed", styles, className)} />;
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "bad" | "accent"; children: ReactNode }) {
  const t = {
    neutral: "bg-canvas text-muted border-line",
    ok: "bg-green-50 text-ok border-green-200",
    warn: "bg-amber-50 text-warn border-amber-200",
    bad: "bg-red-50 text-bad border-red-200",
    accent: "bg-accent/10 text-accent border-transparent",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/20 p-4 pt-16" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cx("rounded-lg px-3 py-1.5 text-sm", value === t.id ? "bg-accent text-white" : "text-muted hover:bg-canvas")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const ErrorText = ({ children }: { children: ReactNode }) => (children ? <p className="text-sm text-bad">{children}</p> : null);
export const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-sm text-muted">{children}</p>;
export const Spinner = () => <div className="py-10 text-center text-sm text-muted">Loading…</div>;

/** Run an async action with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      if (success) setDone(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, done, run, setError };
}

export const Notice = ({ children }: { children: ReactNode }) => (children ? <p className="text-sm text-ok">{children}</p> : null);

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
