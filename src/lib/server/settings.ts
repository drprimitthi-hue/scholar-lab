import "server-only";
import { DEFAULT_SETTINGS } from "../domain/defaults";
import type { LabSettings } from "../types";
import { db } from "./admin";

export async function getSettings(): Promise<LabSettings> {
  const snap = await db().doc("settings/lab").get();
  return { ...DEFAULT_SETTINGS, ...((snap.data() as Partial<LabSettings> | undefined) ?? {}) };
}

export function randomPassword(): string {
  // 16 chars from an unambiguous alphabet; guaranteed upper, lower, digit
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit;
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  const chars = Array.from(bytes, (b) => all[b % all.length]!);
  chars[0] = upper[bytes[0]! % upper.length]!;
  chars[1] = lower[bytes[1]! % lower.length]!;
  chars[2] = digit[bytes[2]! % digit.length]!;
  // shuffle
  const sh = crypto.getRandomValues(new Uint32Array(16));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = sh[i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
