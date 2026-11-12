import { stepOf } from "@/lib/domain/outputs";
import type { OutputKind } from "@/lib/types";

export function statusTone(kind: OutputKind, status: string): "ok" | "warn" | "bad" | "accent" | "neutral" {
  if (status === "rejected") return "bad";
  const st = stepOf(kind, status);
  if (st?.terminal) return "ok";
  if (st?.supervisorOnly) return "accent";
  return "neutral";
}
