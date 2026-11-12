"use client";
import { useState } from "react";

// Lightweight SVG charts (no external library). Palette: validated reference categorical slots;
// heatmap uses a single-hue sequential ramp. Text always uses ink colours, never series colours.
export const SERIES = { planned: "#9a9890", submitted: "#eb6834", accepted: "#2a78d6" } as const;
const SEQ = ["#efeee9", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "4 3" : undefined} /></svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Cumulative planned vs submitted vs accepted, with a hover crosshair and tooltip. */
export function BurnUp({ dates, series }: { dates: string[]; series: { key: keyof typeof SERIES; label: string; values: (number | null)[] }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (dates.length < 2) return <p className="py-6 text-center text-sm text-muted">Not enough data yet.</p>;
  const W = 640, H = 220, L = 36, R = 12, T = 10, B = 26;
  const max = Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const x = (i: number) => L + (i / (dates.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, Math.round(max / 2), max];
  const lab = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  return (
    <div>
      <Legend items={series.map((s) => ({ label: s.label, color: SERIES[s.key], dashed: s.key === "planned" }))} />
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Reading progress over time"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(dates.length - 1, Math.round(((px - L) / (W - L - R)) * (dates.length - 1)))));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e4dc" strokeWidth="1" />
              <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{t}</text>
            </g>
          ))}
          <text x={L} y={H - 6} fontSize="10" fill="#6b7280">{lab(dates[0]!)}</text>
          <text x={W - R} y={H - 6} fontSize="10" fill="#6b7280" textAnchor="end">{lab(dates[dates.length - 1]!)}</text>
          {series.map((s) => (
            <polyline key={s.key} fill="none" stroke={SERIES[s.key]} strokeWidth="2" strokeLinejoin="round" strokeDasharray={s.key === "planned" ? "5 4" : undefined}
              points={s.values.flatMap((v, i) => (v === null ? [] : [`${x(i)},${y(v)}`])).join(" ")} />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#1f2933" strokeOpacity="0.25" />
              {series.map((s) => (s.values[hover] ?? null) === null ? null : <circle key={s.key} cx={x(hover)} cy={y(s.values[hover]!)} r="4" fill={SERIES[s.key]} stroke="#fff" strokeWidth="2" />)}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-1 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow" style={{ left: `${Math.min(75, (x(hover) / W) * 100)}%` }}>
            <p className="mb-1 font-medium">{lab(dates[hover]!)}</p>
            {series.map((s) => <p key={s.key} className="text-muted">{s.label}: <span className="font-medium text-ink">{s.values[hover] ?? "—"}</span></p>)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal funnel: one hue, value labels on each bar. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm" title={`${s.label}: ${s.value}`}>
          <span className="text-muted">{s.label}</span>
          <div className="h-5 rounded-r bg-canvas">
            <div className="h-5 rounded-r" style={{ width: `${(s.value / max) * 100}%`, background: "#2a78d6" }} />
          </div>
          <span className="text-right font-medium">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Rows × days activity grid with a sequential single-hue scale. */
export function Heatmap({ rows, days, value, off }: { rows: { id: string; label: string }[]; days: string[]; value: (rowId: string, day: string) => number; off?: (rowId: string, day: string) => boolean }) {
  const all = rows.flatMap((r) => days.map((d) => value(r.id, d)));
  const max = Math.max(1, ...all);
  const step = (v: number) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor(((v - 1) / max) * 5)));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap pr-3 text-muted">{r.label}</td>
              {days.map((d) => {
                const v = value(r.id, d);
                const isOff = off?.(r.id, d) && v === 0;
                return (
                  <td key={d} className="p-[1px]">
                    <div title={`${r.label} · ${d}: ${v}${isOff ? " (off / leave)" : ""}`} className="h-3.5 w-3.5 rounded-[3px]"
                      style={{ background: isOff ? "repeating-linear-gradient(45deg,#efeee9,#efeee9 2px,#fff 2px,#fff 4px)" : SEQ[step(v)] }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted">
        Less {SEQ.map((c) => <span key={c} className="inline-block h-3 w-3 rounded-[3px]" style={{ background: c }} />)} More
        <span className="ml-3 inline-block h-3 w-3 rounded-[3px]" style={{ background: "repeating-linear-gradient(45deg,#efeee9,#efeee9 2px,#fff 2px,#fff 4px)" }} /> Off / leave
      </div>
    </div>
  );
}

/** Single-series line over labelled points (e.g. talk scores over time), with hover tooltip. */
export function LineChart({ points, min = 0, max, label, color = "#2a78d6" }: { points: { x: string; y: number; title?: string }[]; min?: number; max?: number; label: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="py-6 text-center text-sm text-muted">Needs at least two data points.</p>;
  const W = 640, H = 200, L = 30, R = 12, T = 10, B = 26;
  const hi = max ?? Math.max(1, ...points.map((p) => p.y));
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (hi - min || 1)) * (H - T - B);
  const ticks = [min, (min + hi) / 2, hi];
  const lab = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : d);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(points.length - 1, Math.round(((px - L) / (W - L - R)) * (points.length - 1))))); }}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e4dc" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Number.isInteger(t) ? t : t.toFixed(1)}</text></g>)}
        <text x={L} y={H - 6} fontSize="10" fill="#6b7280">{lab(points[0]!.x)}</text>
        <text x={W - R} y={H - 6} fontSize="10" fill="#6b7280" textAnchor="end">{lab(points[points.length - 1]!.x)}</text>
        <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={points.map((p, i) => `${x(i)},${y(p.y)}`).join(" ")} />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.y)} r={hover === i ? 5 : 3} fill={color} stroke="#fff" strokeWidth="1.5" />)}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow" style={{ left: `${Math.min(70, (x(hover) / W) * 100)}%` }}>
          <p className="font-medium">{lab(points[hover]!.x)}</p>
          {points[hover]!.title && <p className="text-muted">{points[hover]!.title}</p>}
          <p>{label}: <span className="font-medium">{points[hover]!.y.toFixed(1)}</span></p>
        </div>
      )}
    </div>
  );
}
