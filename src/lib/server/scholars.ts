import "server-only";
import { fileInfo } from "./storage";
import type { DocumentReference } from "firebase-admin/firestore";
import { db } from "./admin";
import { HttpError } from "./http";
import { canAccessScholar, type AuthContext } from "./policy";
import type { ScholarDoc } from "../types";

export async function loadScholar(uid: string): Promise<{ ref: DocumentReference; data: ScholarDoc }> {
  const ref = db().doc(`scholars/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Scholar not found");
  return { ref, data: snap.data() as ScholarDoc };
}

export async function requireScholarAccess(ctx: AuthContext, uid: string) {
  const s = await loadScholar(uid);
  if (!canAccessScholar(ctx, uid, s.data.mentorUids ?? [])) throw new HttpError(403, "Not permitted");
  return s;
}

/** Ensure every uid is an existing mentor account. */
export async function assertMentors(uids: string[]): Promise<void> {
  const unique = [...new Set(uids)];
  if (unique.length !== uids.length) throw new HttpError(400, "Duplicate mentor");
  for (const u of unique) {
    const snap = await db().doc(`users/${u}`).get();
    if (!snap.exists || snap.get("role") !== "mentor") throw new HttpError(400, "Mentor not found");
  }
}

/** Ensure an uploaded object exists under the scholar's folder; returns its metadata. */
export async function assertUpload(uid: string, path: string) {
  if (!path.startsWith(`scholars/${uid}/uploads/`)) throw new HttpError(400, "File does not belong to this scholar");
  const info = await fileInfo(path);
  if (!info) throw new HttpError(400, "Uploaded file not found");
  return info;
}

/** Collections whose documents carry `uid` + `mentorUids` copies of a scholar's mentor list. */
export const SCHOLAR_SCOPED_COLLECTIONS = ["presence", "leaves", "readingCards", "conceptNotes", "sessionScores", "tasks"] as const;
export const SCHOLAR_PRIVATE_DOCS = ["scholarNotes"] as const;
export const SCHOLAR_SUBCOLLECTIONS = ["milestones", "documents"] as const;
