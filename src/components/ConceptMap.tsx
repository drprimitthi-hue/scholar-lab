"use client";
import { levels } from "@/lib/domain/concepts";
import type { Concept, Mastery } from "@/lib/types";

// Mastery is ordered, so it uses one sequential hue (light → dark). Locked concepts are dashed.
export const MASTERY_STYLE: Record<Mastery | "none", { fill: string; text: string; label: string }> = {
  none: { fill: "#ffffff", text: "#1f2933", label: "Not started" },
  heard: { fill: "#cde2fb", text: "#1f2933", label: "Heard" },
  explained: { fill: "#86b6ef", text: "#1f2933", label: "Explained" },
  applied: { fill: "#3987e5", text: "#ffffff", label: "Applied" },
  taught: { fill: "#1c5cab", text: "#ffffff", label: "Taught" },
};

export function ConceptMap({ concepts, mastery, locked, selected, onSelect, caption }: {
  concepts: Concept[];
  mastery: (id: string) => Mastery | "none";
  locked?: (id: string) => boolean;
  selected?: string | null;
  onSelect?: (id: string) => void;
  caption?: (id: string) => string;
}) {
  if (!concepts.length) return <p className="py-6 text-center text-sm text-muted">No concepts yet.</p>;
  const lv = levels(concepts);
  const cols = new Map<number, Concept[]>();
  [...concepts].sort((a, b) => a.order - b.order).forEach((c) => cols.set(lv.get(c.id) ?? 0, [...(cols.get(lv.get(c.id) ?? 0) ?? []), c]));
  const W = 176, H = 46, GX = 70, GY = 18, PAD = 12;
  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 0;
  for (const [l, cs] of cols) {
    maxRows = Math.max(maxRows, cs.length);
    cs.forEach((c, i) => pos.set(c.id, { x: PAD + l * (W + GX), y: PAD + i * (H + GY) }));
  }
  const width = PAD * 2 + (Math.max(...cols.keys()) + 1) * (W + GX) - GX;
  const height = PAD * 2 + maxRows * (H + GY) - GY;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(MASTERY_STYLE) as (Mastery | "none")[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded-sm border border-line" style={{ background: MASTERY_STYLE[k].fill }} />{MASTERY_STYLE[k].label}</span>
        ))}
        {locked && <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded-sm border border-dashed border-gray-400" />Locked (prerequisites first)</span>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-canvas/50">
        <svg width={width} height={height} role="img" aria-label="Concept map">
          {concepts.flatMap((c) => c.prerequisites.filter((p) => pos.has(p)).map((p) => {
            const a = pos.get(p)!, b = pos.get(c.id)!;
            const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
            return <path key={`${p}-${c.id}`} d={`M${x1},${y1} C${x1 + GX / 2},${y1} ${x2 - GX / 2},${y2} ${x2},${y2}`} fill="none" stroke="#9a9890" strokeWidth="1.5" markerEnd="url(#arr)" />;
          }))}
          <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9a9890" /></marker></defs>
          {concepts.map((c) => {
            const p = pos.get(c.id)!;
            const m = mastery(c.id);
            const st = MASTERY_STYLE[m];
            const isLocked = locked?.(c.id) ?? false;
            const sel = selected === c.id;
            return (
              <g key={c.id} transform={`translate(${p.x},${p.y})`} className={onSelect ? "cursor-pointer" : ""} onClick={() => onSelect?.(c.id)}>
                <title>{`${c.title} — ${st.label}${isLocked ? " (locked)" : ""}${caption ? ` · ${caption(c.id)}` : ""}`}</title>
                <rect width={W} height={H} rx="10" fill={isLocked ? "#f7f6f2" : st.fill} stroke={sel ? "#1f2933" : isLocked ? "#9a9890" : "#e7e4dc"} strokeWidth={sel ? 2 : 1} strokeDasharray={isLocked ? "4 3" : undefined} />
                <text x="10" y={caption ? 19 : 27} fontSize="12" fontWeight="600" fill={isLocked ? "#6b7280" : st.text}>{c.title.length > 24 ? `${c.title.slice(0, 23)}…` : c.title}</text>
                {caption && <text x="10" y="35" fontSize="10.5" fill={isLocked ? "#6b7280" : st.text} opacity="0.85">{caption(c.id)}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
