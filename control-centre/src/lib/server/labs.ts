import "server-only";
import { db } from "./admin";
import { HttpError } from "./http";
import type { Lab } from "../types";

export async function loadLab(id: string) {
  if (!/^[a-z0-9-]{3,40}$/.test(id)) throw new HttpError(400, "Invalid id");
  const ref = db().doc(`labs/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Lab not found");
  return { ref, lab: snap.data() as Lab };
}
