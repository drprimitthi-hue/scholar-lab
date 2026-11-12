"use client";
import { auth } from "./firebase";

export async function api<T = { ok: true }>(path: string, method = "GET", body?: unknown): Promise<T> {
  const u = auth().currentUser;
  if (!u) throw new Error("Not signed in");
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${await u.getIdToken()}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
