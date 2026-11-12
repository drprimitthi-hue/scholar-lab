import { z } from "zod";

const s = (n: number) => z.string().trim().max(n);
const date = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]);

export const labSchema = z.strictObject({
  labName: s(120).min(2),
  faculty: z.strictObject({ name: s(120).min(2), designation: s(120), department: s(200), institution: s(200), email: z.union([z.email().max(200), z.literal("")]), phone: s(40) }),
  domains: z.array(s(200).regex(/^[a-z0-9.-]+$/i, "Domain like lab.example.org")).max(10),
  joinedOn: date,
  agreementRef: s(200),
  firebaseProjectId: s(100),
  vercelProject: s(100),
  siteUrl: z.union([z.string().trim().max(300).regex(/^https:\/\/[^\s]+$/), z.literal("")]),
  notes: s(4000),
  handover: z.strictObject({
    firebaseCreated: date, ownerInvited: date, ownerAccepted: date, billingSwitched: date, adminRemoved: date, agreementSigned: date,
  }),
});
export const labCreateSchema = labSchema.extend({ id: z.string().regex(/^[a-z0-9-]{3,40}$/, "Lab id: 3–40 lowercase letters, digits or dashes") });

export const licenceSchema = z.strictObject({ expiresOn: date, graceDays: z.number().int().min(0).max(180) });
export const statusSchema = z.strictObject({ status: z.enum(["active", "suspended", "revoked"]), message: s(500), readOnlyDays: z.number().int().min(0).max(180) });
export const heartbeatSchema = z.strictObject({ token: z.string().max(8192), version: s(40), domain: s(200) });
export const setupSchema = z.strictObject({
  setupToken: z.string().min(24).max(200),
  email: z.email().max(200),
  password: z.string().min(12).max(64).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
});
