import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FileRef } from "../types";

export interface BundleItem { section: string; date: string; title: string; detail: string; files: FileRef[] }

const A4: [number, number] = [595.28, 841.89];
const M = 50;

/** Standard PDF fonts only cover Western characters: map common punctuation, replace the rest. */
export function winAnsi(s: string): string {
  return s
    .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/₹/g, "Rs.").replace(/[   ]/g, " ")
    .replace(/[^\x20-\x7E¡-ÿ\n]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of winAnsi(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { if (line) out.push(line); line = font.widthOfTextAtSize(word, size) <= width ? word : word.slice(0, Math.floor(width / (size * 0.5))); }
    }
    out.push(line);
  }
  return out;
}

export const MAX_FILES = 200;
export const MAX_BYTES = 60 * 1024 * 1024;

// Pure (no Firebase): the caller supplies a reader for stored files, so this is unit-tested.
/** Build: cover, index (item → start page), then every attached file in order. Returns the PDF bytes. */
export type Reader = (path: string) => Promise<{ size: number; type: string; bytes: () => Promise<Uint8Array> }>;

export async function buildBundle(opts: { title: string; owner: string; period: string; items: BundleItem[]; label?: string }, read: Reader): Promise<{ bytes: Uint8Array; files: number; skipped: string[] }> {
  const out = await PDFDocument.create();
  out.setTitle(winAnsi(opts.title));
  out.setProducer("Scholar Lab");
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.4, 0.4, 0.4);

  // 1) Load every file first, so the index can give page numbers.
  const skipped: string[] = [];
  let total = 0;
  let count = 0;
  const loaded: { item: number; ref: FileRef; pdf?: PDFDocument; img?: { bytes: Uint8Array; type: string } }[] = [];
  for (const [i, it] of opts.items.entries()) {
    for (const f of it.files) {
      if (count >= MAX_FILES) { skipped.push(`${f.name} (file limit reached)`); continue; }
      try {
        const meta = await read(f.path);
        if (total + meta.size > MAX_BYTES) { skipped.push(`${f.name} (size limit reached)`); continue; }
        const buf = await meta.bytes();
        if (meta.type === "application/pdf") loaded.push({ item: i, ref: f, pdf: await PDFDocument.load(buf, { ignoreEncryption: true }) });
        else loaded.push({ item: i, ref: f, img: { bytes: buf, type: meta.type } });
        total += meta.size; count++;
      } catch {
        skipped.push(`${f.name} (could not be read)`);
      }
    }
  }

  // 2) Cover page.
  const cover = out.addPage(A4);
  let y = A4[1] - 160;
  for (const l of wrap(opts.title, bold, 22, A4[0] - 2 * M)) { cover.drawText(l, { x: M, y, size: 22, font: bold }); y -= 30; }
  y -= 10;
  for (const l of [opts.label ?? "", opts.owner, opts.period, `Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, `${opts.items.length} item(s), ${loaded.length} attached file(s)`].filter(Boolean))
    { cover.drawText(winAnsi(l), { x: M, y, size: 12, font, color: grey }); y -= 18; }

  // 3) Index pages: compute how many we need, then page numbers.
  const rows = opts.items.map((it) => `${it.section} | ${it.date} | ${it.title}`);
  const lineH = 13;
  const perPage = Math.floor((A4[1] - 2 * M - 40) / lineH);
  const rowLines = rows.map((r) => wrap(r, font, 9, A4[0] - 2 * M - 60).length);
  let idxPages = 1, used = 0;
  for (const n of rowLines) { if (used + n > perPage) { idxPages++; used = 0; } used += n; }
  let page = 1 + idxPages + 1; // next free page number (1-based)
  const startPage: (number | null)[] = opts.items.map(() => null);
  const pagesOf = (x: (typeof loaded)[number]) => (x.pdf ? x.pdf.getPageCount() : 1);
  for (const x of loaded) { if (startPage[x.item] === null) startPage[x.item] = page; page += pagesOf(x); }

  let ip: PDFPage = out.addPage(A4);
  y = A4[1] - M;
  ip.drawText("Index", { x: M, y, size: 16, font: bold }); y -= 28;
  opts.items.forEach((it, i) => {
    const lines = wrap(rows[i]!, font, 9, A4[0] - 2 * M - 60);
    if (y - lines.length * lineH < M) { ip = out.addPage(A4); y = A4[1] - M; }
    lines.forEach((l, j) => { ip.drawText(l, { x: M, y: y - j * lineH, size: 9, font }); });
    ip.drawText(startPage[i] ? `p. ${startPage[i]}` : "no file", { x: A4[0] - M - 45, y, size: 9, font, color: grey });
    y -= lines.length * lineH + 3;
  });
  if (skipped.length) {
    if (y < M + 60) { ip = out.addPage(A4); y = A4[1] - M; }
    y -= 10; ip.drawText("Not included:", { x: M, y, size: 9, font: bold }); y -= lineH;
    for (const s of skipped.slice(0, 20)) { ip.drawText(winAnsi(s).slice(0, 110), { x: M, y, size: 8, font, color: grey }); y -= 11; }
  }

  // 4) The files, with a small footer naming the item.
  for (const x of loaded) {
    const it = opts.items[x.item]!;
    const footer = winAnsi(`${it.section}: ${it.title}`).slice(0, 120);
    if (x.pdf) {
      const pages = await out.copyPages(x.pdf, x.pdf.getPageIndices()).catch(() => null);
      if (!pages) { const p = out.addPage(A4); p.drawText(winAnsi(`Could not include ${x.ref.name}`), { x: M, y: A4[1] / 2, size: 12, font }); continue; }
      for (const p of pages) { out.addPage(p); p.drawText(footer, { x: 20, y: 8, size: 7, font, color: grey }); }
    } else if (x.img) {
      const p = out.addPage(A4);
      try {
        const img = x.img.type === "image/png" ? await out.embedPng(x.img.bytes) : x.img.type === "image/jpeg" ? await out.embedJpg(x.img.bytes) : null;
        if (!img) throw new Error("unsupported");
        const s = Math.min((A4[0] - 2 * M) / img.width, (A4[1] - 2 * M) / img.height, 1);
        p.drawImage(img, { x: (A4[0] - img.width * s) / 2, y: (A4[1] - img.height * s) / 2, width: img.width * s, height: img.height * s });
      } catch { p.drawText(winAnsi(`Image ${x.ref.name} (format not embeddable; open it from the app)`), { x: M, y: A4[1] / 2, size: 11, font }); }
      p.drawText(footer, { x: 20, y: 8, size: 7, font, color: grey });
    }
  }
  return { bytes: await out.save(), files: loaded.length, skipped };
}

/** Group items (in order) into bundle parts whose attached files stay under `budget` bytes.
 *  Items without files join the current part. A single file larger than `budget` cannot fit in any part
 *  and is reported in `tooLarge` (it can still be opened from the app). */
export function groupForParts(itemFileSizes: number[][], budget: number): { parts: number[][]; tooLarge: [number, number][] } {
  const parts: number[][] = [[]];
  const tooLarge: [number, number][] = [];
  let used = 0;
  itemFileSizes.forEach((sizes, i) => {
    let size = 0;
    sizes.forEach((sz, j) => { if (sz > budget) tooLarge.push([i, j]); else size += sz; });
    if (used > 0 && used + size > budget) { parts.push([]); used = 0; }
    parts[parts.length - 1]!.push(i);
    used += size;
  });
  return { parts: parts.filter((p) => p.length), tooLarge };
}
