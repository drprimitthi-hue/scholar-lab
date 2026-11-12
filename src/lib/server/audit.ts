import "server-only";
import type { Transaction, WriteBatch } from "firebase-admin/firestore";
import { db } from "./admin";
import type { AuthContext } from "./policy";

/** Append a write-once audit entry in the same batch/transaction as the change it records. */
export function audit(
  w: WriteBatch | Transaction,
  ctx: Pick<AuthContext, "uid" | "role"> | { uid: string; role: string },
  action: string,
  targetType: string,
  targetId: string,
  before: unknown = null,
  after: unknown = null,
): void {
  const ref = db().collection("auditLog").doc();
  const entry = {
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action,
    targetType,
    targetId,
    before: before ?? null,
    after: after ?? null,
    at: Date.now(),
  };
  // Both WriteBatch and Transaction expose set(ref, data)
  (w as WriteBatch).set(ref, entry);
}
