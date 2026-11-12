"use client";
import { useState } from "react";
import { openFile, uploadOfficeFile } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { FileRef } from "@/lib/types";
import { Badge, ErrorText, Input } from "@/components/ui";

/** Pick several options (chips). Used wherever more than one category can apply. */
export function MultiSelect({ options, value, onChange, placeholder = "Add…" }: { options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const rest = options.filter((o) => !value.includes(o) && o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-xl border border-line bg-white p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <button key={v} type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent hover:bg-accent/20" aria-label={`Remove ${v}`}>{v} ✕</button>
        ))}
        <input className="min-w-28 flex-1 bg-transparent px-1 text-sm outline-none" placeholder={value.length ? "" : placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {(q || !value.length) && rest.length > 0 && (
        <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto border-t border-line pt-2">
          {rest.map((o) => <button key={o} type="button" onClick={() => { onChange([...value, o]); setQ(""); }} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-accent hover:text-accent">+ {o}</button>)}
        </div>
      )}
      {!q && value.length > 0 && rest.length > 0 && <p className="mt-1 px-1 text-[11px] text-muted">Type to add more</p>}
    </div>
  );
}

export function FileList({ files, onRemove }: { files: FileRef[]; onRemove?: (path: string) => void }) {
  if (!files.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {files.map((f) => (
        <li key={f.path} className="flex items-center justify-between gap-2">
          <button type="button" className="truncate text-left text-accent hover:underline" onClick={() => openFile(f.path).catch((e: Error) => alert(e.message))}>{f.name}</button>
          {onRemove && <button type="button" className="text-xs text-muted hover:text-bad" onClick={() => onRemove(f.path)}>remove</button>}
        </li>
      ))}
    </ul>
  );
}

/** Attach PDFs/images to an office item (uploaded privately at once; saved with the item). */
export function FileField({ value, onChange }: { value: FileRef[]; onChange: (v: FileRef[]) => void }) {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <FileList files={value} onRemove={(p) => onChange(value.filter((f) => f.path !== p))} />
      <Input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={async (e) => {
        const list = Array.from(e.target.files ?? []); e.target.value = "";
        setBusy(true); setErr(null);
        const added: FileRef[] = [];
        try { for (const f of list) added.push(await uploadOfficeFile(s.user!.uid, f)); } catch (x) { setErr((x as Error).message); }
        onChange([...value, ...added]); setBusy(false);
      }} />
      {busy && <p className="text-xs text-muted">Uploading…</p>}
      <ErrorText>{err}</ErrorText>
    </div>
  );
}

export const Cats = ({ list }: { list: string[] }) => <span className="flex flex-wrap gap-1">{list.map((c) => <Badge key={c}>{c}</Badge>)}</span>;

/** Pick from a settings list, or type something else. */
export function ListInput({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = `dl-${options.length}-${(placeholder ?? "x").replace(/\W/g, "")}`;
  return <><Input list={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /><datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist></>;
}

export const nowHHMM = () => new Date().toTimeString().slice(0, 5);
