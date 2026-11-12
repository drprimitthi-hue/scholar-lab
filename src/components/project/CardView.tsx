"use client";
import type { ReadingCard } from "@/lib/types";

export function CardView({ c }: { c: ReadingCard }) {
  const row = (label: string, v?: string) => (v ? <div><dt className="text-xs font-medium text-muted">{label}</dt><dd className="whitespace-pre-wrap text-sm">{v}</dd></div> : null);
  return (
    <dl className="space-y-2">
      {row("Problem", c.problem)}
      {row("Method", c.method)}
      {row("Hardware / dataset / setup", c.setup)}
      {row("Key result", c.keyResult)}
      {row("Limitations", c.limitations)}
      {c.concepts?.length ? <div><dt className="text-xs font-medium text-muted">Key concepts</dt><dd className="mt-1 flex flex-wrap gap-1">{c.concepts.map((k) => <span key={k} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">{k}</span>)}</dd></div> : null}
      {row("Citable claim", c.citableClaim)}
      {c.relevance ? <div className="text-xs text-muted">Relevance: <b className="text-ink">{c.relevance}/5</b></div> : null}
    </dl>
  );
}
