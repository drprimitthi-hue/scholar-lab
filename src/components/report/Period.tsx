"use client";
import { addDays, addMonths } from "@/lib/domain/dates";
import { Field, Input, Select } from "@/components/ui";

export function presetsFor(today: string) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const fy = m >= 4 ? y : y - 1, ay = m >= 7 ? y : y - 1;
  return [
    { id: "m1", label: "Last month", from: addMonths(today, -1), to: today },
    { id: "m3", label: "Last 3 months", from: addMonths(today, -3), to: today },
    { id: "m6", label: "Last 6 months", from: addMonths(today, -6), to: today },
    { id: "fy", label: `Apr ${fy} – today`, from: `${fy}-04-01`, to: today },
    { id: "fyl", label: `Apr ${fy - 1} – Mar ${fy}`, from: `${fy - 1}-04-01`, to: `${fy}-03-31` },
    { id: "ay", label: `Jul ${ay} – today`, from: `${ay}-07-01`, to: today },
    { id: "ayl", label: `Jul ${ay - 1} – Jun ${ay}`, from: `${ay - 1}-07-01`, to: `${ay}-06-30` },
    { id: "w", label: "Last 7 days", from: addDays(today, -6), to: today },
  ];
}

export function PeriodPicker({ today, from, to, onChange }: { today: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
  const P = presetsFor(today);
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Quick period"><Select value="" onChange={(e) => { const p = P.find((x) => x.id === e.target.value); if (p) onChange(p.from, p.to); }}><option value="">Choose…</option>{P.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
      <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => onChange(e.target.value, to)} /></Field>
      <Field label="To"><Input type="date" value={to} min={from} onChange={(e) => onChange(from, e.target.value)} /></Field>
    </div>
  );
}
