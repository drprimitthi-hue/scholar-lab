import "server-only";
import { bucket } from "./admin";
import { HttpError } from "./http";
import { privateDownloadUrl, signedUploadFields, type CloudinaryConfig } from "./cloudinarySign";

/**
 * File storage, switchable per lab:
 *  - "cloudinary": free plan, no card needed. Every file is uploaded as `authenticated` (private) with a
 *    server-made signature for that exact path; downloads use time-limited signed links.
 *  - "firebase": Cloud Storage for Firebase (needs the Blaze plan), files kept in the lab's chosen region.
 * File paths are identical in both, so records never change when a lab switches.
 */
export type Provider = "cloudinary" | "firebase";

export function provider(): Provider {
  const v = (process.env.FILE_STORAGE ?? "").trim().toLowerCase();
  if (v === "cloudinary") return "cloudinary";
  if (v === "firebase" || v === "") return "firebase";
  throw new HttpError(500, "FILE_STORAGE must be 'cloudinary' or 'firebase'");
}

export function cloudinaryConfig(): CloudinaryConfig {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim(), key = process.env.CLOUDINARY_API_KEY?.trim(), secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud || !key || !secret) throw new HttpError(500, "Cloudinary is not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
  return { cloud, key, secret };
}

const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
export const typeOfPath = (path: string) => TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

const auth = (c: CloudinaryConfig) => `Basic ${Buffer.from(`${c.key}:${c.secret}`).toString("base64")}`;
const adminUrl = (c: CloudinaryConfig, p: string) => `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}${p}`;
const nowSec = () => Math.floor(Date.now() / 1000);

/** Size and type of a stored file, or null if it does not exist. */
export async function fileInfo(path: string, p: Provider = provider()): Promise<{ size: number; contentType: string } | null> {
  if (p === "firebase") {
    const f = bucket().file(path);
    const [exists] = await f.exists();
    if (!exists) return null;
    const [meta] = await f.getMetadata();
    return { size: Number(meta.size ?? 0), contentType: String(meta.contentType ?? "") };
  }
  const c = cloudinaryConfig();
  const r = await fetch(adminUrl(c, `/resources/raw/authenticated/${path.split("/").map(encodeURIComponent).join("/")}`), { headers: { Authorization: auth(c) }, cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new HttpError(502, `File storage did not answer (${r.status})`);
  const j = (await r.json()) as { bytes?: number };
  return { size: Number(j.bytes ?? 0), contentType: typeOfPath(path) };
}

/** A short-lived link to open or download a stored file. */
export async function readUrl(path: string, seconds = 300, p: Provider = provider()): Promise<string> {
  if (p === "firebase") {
    const [url] = await bucket().file(path).getSignedUrl({ action: "read", expires: Date.now() + seconds * 1000, version: "v4" });
    return url;
  }
  return privateDownloadUrl(cloudinaryConfig(), path, nowSec(), seconds);
}

/** Read a stored file's bytes (server side). */
export async function readBytes(path: string, p: Provider = provider()): Promise<Uint8Array> {
  if (p === "firebase") return new Uint8Array((await bucket().file(path).download())[0]);
  const r = await fetch(await readUrl(path, 120, p), { cache: "no-store" });
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Save bytes from the server (evidence bundles, migration). */
export async function saveBytes(path: string, bytes: Uint8Array, contentType: string, p: Provider = provider()): Promise<void> {
  if (p === "firebase") {
    await bucket().file(path).save(Buffer.from(bytes), { contentType, resumable: false });
    return;
  }
  const c = cloudinaryConfig();
  const u = signedUploadFields(c, path, nowSec());
  const form = new FormData();
  for (const [k, v] of Object.entries(u.fields)) form.append(k, v);
  form.append("file", new Blob([Buffer.from(bytes)], { type: contentType }), path.split("/").pop());
  const r = await fetch(u.url, { method: "POST", body: form });
  if (!r.ok) throw new HttpError(502, `Could not save the file (${r.status}): ${(await r.text()).slice(0, 200)}`);
}

/** What the browser needs to upload one file to an exact path. */
export function uploadTicket(path: string, contentType: string, p: Provider = provider()) {
  if (p === "firebase") return { provider: p, path, contentType };
  const u = signedUploadFields(cloudinaryConfig(), path, nowSec());
  return { provider: p, path, contentType, url: u.url, fields: u.fields };
}

/** Delete every file under a folder (used by the scheduled purge). */
export async function deletePrefix(prefix: string, p: Provider = provider()): Promise<void> {
  if (p === "firebase") { await bucket().deleteFiles({ prefix }); return; }
  const c = cloudinaryConfig();
  const r = await fetch(adminUrl(c, `/resources/raw/authenticated?prefix=${encodeURIComponent(prefix)}`), { method: "DELETE", headers: { Authorization: auth(c) } });
  if (!r.ok && r.status !== 404) throw new HttpError(502, `Could not delete files (${r.status})`);
}

/** List files under a folder: path, size and creation time. Paged. */
export async function listPrefix(prefix: string, cursor = "", p: Provider = provider()): Promise<{ files: { path: string; size: number; created: number }[]; next: string }> {
  if (p === "firebase") {
    const [files, , resp] = await bucket().getFiles({ prefix, maxResults: 200, pageToken: cursor || undefined, autoPaginate: false });
    return {
      files: files.map((f) => ({ path: f.name, size: Number(f.metadata.size ?? 0), created: Date.parse(String(f.metadata.timeCreated ?? "")) || 0 })),
      next: String((resp as { nextPageToken?: string } | undefined)?.nextPageToken ?? ""),
    };
  }
  const c = cloudinaryConfig();
  const q = new URLSearchParams({ prefix, max_results: "200", ...(cursor ? { next_cursor: cursor } : {}) });
  const r = await fetch(adminUrl(c, `/resources/raw/authenticated?${q}`), { headers: { Authorization: auth(c) }, cache: "no-store" });
  if (!r.ok) throw new HttpError(502, `Could not list files (${r.status})`);
  const j = (await r.json()) as { resources?: { public_id: string; bytes: number; created_at: string }[]; next_cursor?: string };
  return { files: (j.resources ?? []).map((x) => ({ path: x.public_id, size: x.bytes, created: Date.parse(x.created_at) || 0 })), next: j.next_cursor ?? "" };
}

/** Delete specific files. */
export async function deleteFiles(paths: string[], p: Provider = provider()): Promise<void> {
  if (!paths.length) return;
  if (p === "firebase") { await Promise.all(paths.map((x) => bucket().file(x).delete().catch(() => undefined))); return; }
  const c = cloudinaryConfig();
  for (let i = 0; i < paths.length; i += 100) {
    const q = new URLSearchParams();
    for (const x of paths.slice(i, i + 100)) q.append("public_ids[]", x);
    await fetch(adminUrl(c, `/resources/raw/authenticated?${q}`), { method: "DELETE", headers: { Authorization: auth(c) } });
  }
}

/** Largest single file the provider accepts (Cloudinary free plan: 10 MB per file). */
export const maxFileBytes = (p: Provider = provider()) => (p === "cloudinary" ? 10 * 1024 * 1024 : 10 * 1024 * 1024);
/** Bundle part size: Cloudinary's free plan cannot store one file over 10 MB, so bundles are split. */
export const bundlePartBytes = (p: Provider = provider()) => (p === "cloudinary" ? 9 * 1024 * 1024 : Number.POSITIVE_INFINITY);

/** Round trip: write a tiny file, read it back through a signed link, delete it. */
export async function selfTest(): Promise<{ ok: boolean; provider: Provider; detail: string }> {
  let p: Provider;
  try { p = provider(); } catch (e) { return { ok: false, provider: "firebase", detail: (e as Error).message }; }
  const path = `system/selftest-${Date.now()}.pdf`;
  const body = new TextEncoder().encode("%PDF-1.4\n% self-test\n");
  try {
    await saveBytes(path, body, "application/pdf", p);
    const info = await fileInfo(path, p);
    if (!info) throw new Error("the file was not found after saving");
    const back = await readBytes(path, p);
    if (back.length !== body.length) throw new Error("the file read back was different");
    await deleteFiles([path], p);
    return { ok: true, provider: p, detail: p === "cloudinary" ? "Cloudinary: private upload, signed download and delete all work." : "Firebase Storage: upload, signed download and delete all work." };
  } catch (e) {
    return { ok: false, provider: p, detail: `${p === "cloudinary" ? "Cloudinary" : "Firebase Storage"}: ${(e as Error).message}` };
  }
}
