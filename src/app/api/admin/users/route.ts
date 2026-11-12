import type { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertMentors } from "@/lib/server/scholars";
import { getSettings, randomPassword } from "@/lib/server/settings";
import { createUserSchema } from "@/lib/schemas";
import { generateMilestones } from "@/lib/domain/milestones";
import { DEFAULT_TEMPLATES } from "@/lib/domain/defaults";
import { todayInTz } from "@/lib/domain/dates";
import type { MilestoneTemplate, ScholarDoc, UserDoc } from "@/lib/types";

export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, createUserSchema);
  const settings = await getSettings();
  const email = input.email.toLowerCase();

  if (input.role === "scholar") {
    if (!input.programmeId || !settings.programmes.some((p) => p.id === input.programmeId))
      throw new HttpError(400, "Choose a valid programme");
  }
  const mentorUids = input.role === "scholar" ? (input.mentorUids ?? []) : [];
  await assertMentors(mentorUids);

  try {
    await adminAuth().getUserByEmail(email);
    throw new HttpError(409, "An account with this email already exists");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }

  const tempPassword = randomPassword();
  const user = await adminAuth().createUser({ email, password: tempPassword, displayName: input.name, emailVerified: true });
  const now = Date.now();

  try {
    await adminAuth().setCustomUserClaims(user.uid, { role: input.role, active: true });
    const batch = db().batch();
    const userDoc: UserDoc = {
      uid: user.uid,
      email,
      name: input.name,
      role: input.role,
      status: "active",
      mustChangePassword: true,
      createdAt: now,
    };
    batch.set(db().doc(`users/${user.uid}`), userDoc);

    if (input.role === "scholar") {
      const joiningDate = input.joiningDate ?? todayInTz(settings.timezone);
      const scholar: ScholarDoc = {
        uid: user.uid,
        mentorUids,
        name: input.name,
        email,
        phone: "",
        photoPath: "",
        emergencyContact: "",
        address: "",
        enrolmentNo: input.enrolmentNo ?? "",
        programmeId: input.programmeId!,
        specialisation: "",
        batch: "",
        joiningDate,
        mode: "full_time",
        status: settings.statuses[0] ?? "Active",
        researchTopic: "",
        expectedCompletion: "",
        funding: "",
        fundingFrom: "",
        fundingTo: "",
        coSupervisor: "",
        committeeMembers: "",
        proposalApprovedOn: "",
        minDurationMonths: 0,
        maxDurationMonths: 0,
        extensions: "",
        qualifications: [],
        deletion: null,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(db().doc(`scholars/${user.uid}`), scholar);

      const tSnap = await db().doc(`milestoneTemplates/${input.programmeId}`).get();
      const template =
        (tSnap.data() as MilestoneTemplate | undefined) ?? DEFAULT_TEMPLATES.find((t) => t.programmeId === input.programmeId);
      for (const m of generateMilestones(template?.items ?? [], joiningDate)) {
        batch.set(db().collection(`scholars/${user.uid}/milestones`).doc(), {
          ...m,
          uid: user.uid,
          mentorUids,
          status: "not_started",
          completedOn: null,
          scholarNote: "",
          remarks: "",
          approvedBy: null,
          evidence: [],
          updatedAt: now,
        });
      }
    }
    audit(batch, ctx, "user.created", "user", user.uid, null, { email, name: input.name, role: input.role });
    await batch.commit();
  } catch (e) {
    await adminAuth().deleteUser(user.uid).catch(() => undefined); // roll back the auth account
    throw e;
  }

  return ok({ uid: user.uid, tempPassword }, 201);
});
