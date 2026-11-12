import { describe, expect, it } from "vitest";
import { labAlerts } from "@/lib/alerts";
import { labCreateSchema, statusSchema } from "@/lib/schemas";
import type { Lab } from "@/lib/types";

const DAY = 86_400_000;
const base: Lab = {
  id: "x-lab", labName: "X", faculty: { name: "Asha Rao", designation: "", department: "", institution: "", email: "", phone: "" }, domains: [], joinedOn: "", agreementRef: "",
  firebaseProjectId: "", vercelProject: "", siteUrl: "", notes: "",
  handover: { firebaseCreated: "d", ownerInvited: "d", ownerAccepted: "d", billingSwitched: "d", adminRemoved: "d", agreementSigned: "d" },
  status: "active", statusMessage: "", readOnlyUntil: null, licence: { token: "", iat: 0, exp: 100 * DAY, grace: 30 }, lastHeartbeat: { at: 49 * DAY, version: "abc1234", domain: "" }, createdAt: 0, updatedAt: 0,
};

describe("alerts", () => {
  it("healthy lab has none", () => expect(labAlerts(base, 50 * DAY, "abc1234ffff")).toEqual([]));
  it("flags expiry, missed check-ins, old version, pending handover", () => {
    const t = labAlerts({ ...base, handover: { ...base.handover, billingSwitched: "" } }, 80 * DAY, "fff").map((a) => a.text).join(" | ");
    expect(t).toContain("expires in 20");
    expect(t).toContain("No check-in for 31 days");
    expect(t).toContain("not the current release");
    expect(t).toContain("billing switch");
  });
  it("revoked lab shows read-only window", () => {
    expect(labAlerts({ ...base, status: "revoked", readOnlyUntil: 60 * DAY }, 50 * DAY, null)[0]!.text).toContain("read-only until");
  });
});

describe("validation", () => {
  it("lab ids and domains are constrained", () => {
    const lab = { labName: "Lab", faculty: base.faculty, domains: ["lab.example.org"], joinedOn: "", agreementRef: "", firebaseProjectId: "", vercelProject: "", siteUrl: "", notes: "", handover: { firebaseCreated: "", ownerInvited: "", ownerAccepted: "", billingSwitched: "", adminRemoved: "", agreementSigned: "" } };
    expect(labCreateSchema.safeParse({ ...lab, id: "good-id" }).success).toBe(true);
    expect(labCreateSchema.safeParse({ ...lab, id: "../x" }).success).toBe(false);
    expect(labCreateSchema.safeParse({ ...lab, id: "good-id", domains: ["evil.org/<script>"] }).success).toBe(false);
    expect(statusSchema.safeParse({ status: "deleted", message: "", readOnlyDays: 1 }).success).toBe(false);
  });
});
