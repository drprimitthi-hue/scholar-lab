"use client";
import { auth, appCheckToken } from "./firebase";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Call our server API with the signed-in user's ID token. */
export async function api<T = { ok: true }>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const user = auth().currentUser;
  if (!user) throw new ApiError(401, "Not signed in");
  const headers: Record<string, string> = { Authorization: `Bearer ${await user.getIdToken()}` };
  const ac = await appCheckToken();
  if (ac) headers["X-Firebase-AppCheck"] = ac;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data;
}

type Ticket = { provider: "firebase" | "cloudinary"; path: string; contentType: string; url?: string; fields?: Record<string, string> };

/** Upload one file: the server issues a ticket for an exact private path, then the browser sends the file
 *  straight to the lab's file storage (Firebase Storage or Cloudinary). Returns the stored path. */
async function upload(scope: "scholar" | "office", uid: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new ApiError(400, "File is larger than 10 MB");
  if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) throw new ApiError(400, "Only PDF, PNG, JPEG or WebP files");
  const t = await api<Ticket>("/api/files/ticket", "POST", { scope, uid, contentType: file.type, size: file.size });
  if (t.provider === "firebase") {
    const { ref, uploadBytes } = await import("firebase/storage");
    const { storage } = await import("./firebase");
    await uploadBytes(ref(storage(), t.path), file, { contentType: file.type });
    return t.path;
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(t.fields ?? {})) form.append(k, v);
  form.append("file", file);
  const res = await fetch(t.url!, { method: "POST", body: form });
  if (!res.ok) {
    const msg = ((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message;
    throw new ApiError(res.status, msg ? `Upload failed: ${msg}` : `Upload failed (${res.status})`);
  }
  return t.path;
}

/** Upload into a scholar's private folder; returns the stored path. */
export const uploadFile = (scholarUid: string, file: File) => upload("scholar", scholarUid, file);

/** My Office upload (supervisor only, into their private office folder). */
export async function uploadOfficeFile(uid: string, file: File): Promise<{ path: string; name: string; at: number; by: string }> {
  const path = await upload("office", uid, file);
  return { path, name: file.name.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "file", at: Date.now(), by: uid };
}

export async function openFile(path: string): Promise<void> {
  const win = window.open("", "_blank");
  if (win) win.opener = null;
  try {
    const { url } = await api<{ url: string }>(`/api/files?path=${encodeURIComponent(path)}`);
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (e) {
    win?.close();
    throw e;
  }
}
