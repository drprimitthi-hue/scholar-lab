import "server-only";
import { db } from "./admin";
import { HttpError } from "./http";
import { loadScholars } from "./projects";
import type { SessionDoc, Speaker } from "../types";

export async function loadSession(sid: string) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(sid)) throw new HttpError(400, "Invalid id");
  const ref = db().doc(`sessions/${sid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Session not found");
  return { ref, session: snap.data() as SessionDoc };
}

/** Build speaker entries from input, keeping slides/spot-checks already recorded for the same speaker. */
export async function buildSpeakers(input: { uid: string; topic: string; conceptId: string; projectId: string }[], previous: Speaker[] = []): Promise<Speaker[]> {
  const uids = input.map((s) => s.uid);
  if (new Set(uids).size !== uids.length) throw new HttpError(400, "A scholar is listed twice");
  const scholars = await loadScholars(uids);
  const names = new Map(scholars.map((s) => [s.uid, s.name]));
  return input.map((s) => {
    const prev = previous.find((p) => p.uid === s.uid);
    return { ...s, name: names.get(s.uid) ?? "", slidesPath: prev?.slidesPath ?? "", slidesAt: prev?.slidesAt ?? null, spotCheck: prev?.spotCheck ?? [] };
  });
}

export const speakerFields = (speakers: Speaker[]) => ({
  speakers,
  speakerUids: speakers.map((s) => s.uid),
  slidePaths: speakers.map((s) => s.slidesPath).filter(Boolean),
});
