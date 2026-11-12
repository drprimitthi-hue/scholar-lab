import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { getSettings } from "@/lib/server/settings";
import { presenceCorrectSchema, presenceSchema } from "@/lib/schemas";
import { todayInTz, zonedEpoch } from "@/lib/domain/dates";
import { withinRadius } from "@/lib/domain/diff";
import type { PresenceDoc } from "@/lib/types";

/** Scholar checks in / out for today. Only an inside-campus yes/no is stored, never coordinates. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const input = await parseBody(req, presenceSchema);
  const settings = await getSettings();
  const { data: scholar } = await loadScholar(ctx.uid);

  let insideCampus: boolean | null = null;
  if (settings.geofence.enabled) {
    if (input.lat === undefined || input.lng === undefined) throw new HttpError(400, "Location is needed to check in");
    insideCampus = withinRadius(input.lat, input.lng, settings.geofence.lat, settings.geofence.lng, settings.geofence.radiusM);
    if (!insideCampus) throw new HttpError(403, "You appear to be outside the campus area");
  }

  const date = todayInTz(settings.timezone);
  const ref = db().doc(`presence/${ctx.uid}_${date}`);
  const now = Date.now();
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data() as PresenceDoc | undefined;
    if (input.action === "in") {
      if (cur?.checkIn) throw new HttpError(409, "Already checked in today");
      const doc: PresenceDoc = {
        uid: ctx.uid, mentorUids: scholar.mentorUids, date, checkIn: now, checkOut: null,
        insideCampus, status: "present", corrected: null,
      };
      tx.set(ref, doc);
      audit(tx, ctx, "presence.checkin", "presence", ref.id, null, { checkIn: now, insideCampus });
    } else {
      if (!cur?.checkIn) throw new HttpError(409, "Check in first");
      if (cur.checkOut) throw new HttpError(409, "Already checked out today");
      tx.update(ref, { checkOut: now });
      audit(tx, ctx, "presence.checkout", "presence", ref.id, null, { checkOut: now });
    }
  });
  return ok();
});

/** Supervisor (or mentor, if allowed in Settings) corrects a presence record. Always audited. */
export const PATCH = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor"] });
  const input = await parseBody(req, presenceCorrectSchema);
  const settings = await getSettings();
  const { data: scholar } = await loadScholar(input.uid);
  if (ctx.role === "mentor" && (!settings.mentorCanCorrectPresence || !scholar.mentorUids.includes(ctx.uid)))
    throw new HttpError(403, "Not permitted");
  if (input.date > todayInTz(settings.timezone)) throw new HttpError(400, "Cannot record future dates");

  const ref = db().doc(`presence/${input.uid}_${input.date}`);
  const t = (v?: string) => (v ? zonedEpoch(input.date, v, settings.timezone) : null);
  const checkIn = input.status === "present" ? t(input.checkIn) : null;
  const checkOut = input.status === "present" ? t(input.checkOut) : null;
  if (checkIn && checkOut && checkOut < checkIn) throw new HttpError(400, "Check-out is before check-in");

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.data() ?? null;
    const doc: PresenceDoc = {
      uid: input.uid, mentorUids: scholar.mentorUids, date: input.date, checkIn, checkOut,
      insideCampus: (before?.insideCampus as boolean | null | undefined) ?? null, status: input.status,
      corrected: { by: ctx.uid, at: Date.now(), reason: input.reason },
    };
    tx.set(ref, doc);
    audit(tx, ctx, "presence.corrected", "presence", ref.id, before, doc);
  });
  return ok();
});
