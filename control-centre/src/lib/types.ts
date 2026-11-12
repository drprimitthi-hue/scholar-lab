export type LabStatus = "active" | "suspended" | "revoked";

export interface Handover {
  firebaseCreated: string; // ISO date when done, "" if not
  ownerInvited: string;
  ownerAccepted: string;
  billingSwitched: string;
  adminRemoved: string;
  agreementSigned: string;
}

export interface Lab {
  id: string;
  labName: string;
  faculty: { name: string; designation: string; department: string; institution: string; email: string; phone: string };
  domains: string[];
  joinedOn: string;
  agreementRef: string;
  firebaseProjectId: string;
  vercelProject: string;
  siteUrl: string;
  notes: string;
  handover: Handover;
  status: LabStatus;
  statusMessage: string;
  readOnlyUntil: number | null;
  licence: { token: string; iat: number; exp: number | null; grace: number } | null;
  lastHeartbeat: { at: number; version: string; domain: string } | null;
  createdAt: number;
  updatedAt: number;
}
