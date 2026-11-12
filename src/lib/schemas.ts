import { z } from "zod";
import { isIsoDate } from "./domain/dates";

// All API inputs are validated here. Strict objects reject unknown keys; every string and array is bounded.

const s = (max: number) => z.string().trim().max(max);
const isoDate = z.string().refine(isIsoDate, "Invalid date (YYYY-MM-DD)");
const optDate = z.union([isoDate, z.literal("")]);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");
const uid = z.string().regex(/^[A-Za-z0-9]{1,128}$/, "Invalid user id");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be #RRGGBB");
const storagePath = z
  .string()
  .max(300)
  .regex(/^scholars\/[A-Za-z0-9]{1,128}\/uploads\/[A-Za-z0-9._-]{1,200}$/, "Invalid file path");

export const createUserSchema = z.strictObject({
  role: z.enum(["scholar", "mentor"]),
  name: s(120).min(2),
  email: z.email().max(200),
  programmeId: id.optional(),
  joiningDate: isoDate.optional(),
  enrolmentNo: s(60).optional(),
  mentorUids: z.array(uid).max(5).optional(),
});

export const userAdminSchema = z.strictObject({
  action: z.enum(["disable", "enable", "reset_password", "reset_2fa", "archive", "unarchive"]),
});

const qualification = z.strictObject({
  degree: s(120),
  institute: s(200),
  year: s(10),
  score: s(30),
});

export const enrolmentPatchSchema = z
  .strictObject({
    name: s(120).min(2),
    phone: s(30),
    emergencyContact: s(200),
    address: s(400),
    enrolmentNo: s(60),
    programmeId: id,
    specialisation: s(160),
    batch: s(40),
    joiningDate: isoDate,
    mode: z.enum(["full_time", "part_time"]),
    status: s(60),
    researchTopic: s(300),
    expectedCompletion: optDate,
    funding: s(160),
    fundingFrom: optDate,
    fundingTo: optDate,
    coSupervisor: s(160),
    committeeMembers: s(600),
    proposalApprovedOn: optDate,
    minDurationMonths: z.number().int().min(0).max(240),
    maxDurationMonths: z.number().int().min(0).max(240),
    extensions: s(600),
    qualifications: z.array(qualification).max(10),
  })
  .partial();

export const notesSchema = z.strictObject({ notes: s(5000) });

export const mentorsSchema = z.strictObject({ mentorUids: z.array(uid).max(5) });

const programme = z.strictObject({ id, name: s(100).min(1), level: z.enum(["bachelor", "master", "phd"]) });
const leaveType = z.strictObject({ id, name: s(80).min(1), yearlyQuota: z.number().int().min(0).max(366) });

export const settingsSchema = z.strictObject({
  labName: s(120).min(1),
  institution: s(200),
  department: s(200),
  supervisorName: s(120),
  tagline: s(300),
  accent: hex,
  timezone: s(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
  programmes: z.array(programme).min(1).max(20),
  leaveTypes: z.array(leaveType).min(1).max(20),
  holidays: z.array(isoDate).max(100),
  weekendDays: z.array(z.number().int().min(0).max(6)).max(6),
  mentorCanApproveLeave: z.boolean(),
  mentorCanCorrectPresence: z.boolean(),
  geofence: z.strictObject({
    enabled: z.boolean(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radiusM: z.number().min(50).max(20000),
  }),
  idleMinutes: z.number().int().min(5).max(240),
  statuses: z.array(s(60).min(1)).min(1).max(20),
});

export const templateSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        key: id,
        title: s(160).min(1),
        weight: z.number().min(0).max(100),
        offsetMonths: z.number().int().min(0).max(240),
        repeatEveryMonths: z.number().int().min(1).max(60).optional(),
        repeatCount: z.number().int().min(1).max(20).optional(),
      }),
    )
    .max(40),
});

export const milestoneCreateSchema = z.strictObject({
  title: s(160).min(1),
  weight: z.number().min(0).max(100),
  dueDate: isoDate,
});

export const milestoneUpdateSchema = z
  .strictObject({
    title: s(160).min(1),
    weight: z.number().min(0).max(100),
    dueDate: isoDate,
    status: z.enum(["not_started", "in_progress", "submitted", "approved", "waived"]),
    completedOn: optDate,
    remarks: s(2000),
  })
  .partial();

export const milestoneSubmitSchema = z.strictObject({
  scholarNote: s(2000),
  evidence: z.array(z.strictObject({ path: storagePath, name: s(200) })).max(10),
});

export const presenceSchema = z.strictObject({
  action: z.enum(["in", "out"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const presenceCorrectSchema = z.strictObject({
  uid,
  date: isoDate,
  status: z.enum(["present", "absent", "on_leave", "holiday"]),
  checkIn: s(5).regex(/^(\d{2}:\d{2})?$/).optional(),
  checkOut: s(5).regex(/^(\d{2}:\d{2})?$/).optional(),
  reason: s(300).min(3),
});

export const leaveApplySchema = z.strictObject({
  type: id,
  from: isoDate,
  to: isoDate,
  reason: s(1000).min(3),
  documentPath: storagePath.optional(),
});

export const leaveDecisionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("approve"), remark: s(500) }),
  z.strictObject({ action: z.literal("reject"), remark: s(500).min(3) }),
  z.strictObject({ action: z.literal("cancel") }),
]);

export const documentRegisterSchema = z.strictObject({
  title: s(200).min(1),
  category: s(80).min(1),
  path: storagePath,
});

export const deletionSchema = z.strictObject({
  confirmName: s(120).min(1),
  keepMinimal: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type EnrolmentPatch = z.infer<typeof enrolmentPatchSchema>;

// ---------- Phase 2 ----------
const httpUrl = z.string().trim().max(1000).regex(/^https?:\/\/[^\s]+$/i, "Link must start with http:// or https://");
const projectFields = {
  title: s(200).min(3),
  objectives: s(4000),
  status: z.enum(["planned", "active", "on_hold", "completed", "closed"]),
  startDate: isoDate,
  endDate: optDate,
  scholarUids: z.array(uid).max(50),
  releaseMode: z.enum(["date", "gated", "both"]),
  gateThreshold: z.number().min(0.5).max(1),
  minWords: z.number().int().min(0).max(200),
  cardsVisibleToGroup: z.boolean(),
  publicVisible: z.boolean(),
  publicSummary: s(1500),
};
export const projectCreateSchema = z.strictObject(projectFields);
export const projectPatchSchema = z.strictObject(projectFields).partial();

export const litItemSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,48}$/),
  title: s(400).min(1),
  authors: s(400),
  year: s(10),
  venue: s(200),
  url: httpUrl,
  type: z.enum(["review", "primary", "patent", "standard", "datasheet", "tutorial", "other"]),
  priority: z.enum(["core", "supporting", "optional"]),
  theme: s(80).min(1),
  estMinutes: z.number().int().min(1).max(600),
  orderHint: z.number().finite(),
});
export const litImportSchema = z.strictObject({ items: z.array(litItemSchema).min(1).max(2000) });

export const planSchema = z.strictObject({ dailyMinutes: z.number().int().min(10).max(600), startDate: isoDate });
export const planMoveSchema = z.strictObject({ itemId: z.string().regex(/^[A-Za-z0-9_-]{1,48}$/), toBatch: z.number().int().min(1).max(5000) });

export const readingOpenSchema = z.strictObject({ projectId: id, itemId: z.string().regex(/^[A-Za-z0-9_-]{1,48}$/) });
export const cardSchema = z.strictObject({
  projectId: id,
  itemId: z.string().regex(/^[A-Za-z0-9_-]{1,48}$/),
  problem: s(3000),
  method: s(3000),
  setup: s(2000),
  keyResult: s(3000),
  limitations: s(3000),
  concepts: z.array(s(120)).length(3),
  relevance: z.number().int().min(1).max(5),
  citableClaim: s(1000),
});
export const reviewSchema = z.strictObject({
  cardId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  action: z.enum(["accept", "revise"]),
  comment: s(2000),
});
export const suggestionSchema = z.strictObject({ title: s(400).min(3), url: httpUrl, reason: s(1000).min(5) });
export const suggestionDecisionSchema = z.strictObject({
  action: z.enum(["approve", "reject"]),
  type: z.enum(["review", "primary", "patent", "standard", "datasheet", "tutorial", "other"]).optional(),
  priority: z.enum(["core", "supporting", "optional"]).optional(),
  theme: s(80).optional(),
  estMinutes: z.number().int().min(1).max(600).optional(),
});

// ---------- Setup ----------
export const setupSchema = z.strictObject({
  setupToken: z.string().min(24).max(200),
  name: s(120).min(2),
  email: z.email().max(200),
  password: z.string().min(10).max(64).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  labName: s(120).min(2),
  institution: s(200),
});

// ---------- Phase 3: website ----------
const optUrl = z.union([httpUrl, z.literal("")]);
export const siteSchema = z.strictObject({
  about: s(6000),
  themes: z.array(z.strictObject({ title: s(120).min(1), summary: s(1200) })).max(12),
  piTitle: s(200),
  piBio: s(3000),
  links: z.strictObject({ website: optUrl, orcid: optUrl, scholar: optUrl, scopus: optUrl, linkedin: optUrl }),
  contactEmail: z.union([z.email().max(200), z.literal("")]),
  contactPhone: s(40),
  address: s(400),
  autoPublishNews: z.boolean(),
  completionStatuses: z.array(s(60).min(1)).max(10),
});
export const newsSchema = z.strictObject({ title: s(200).min(3), body: s(4000), date: isoDate, link: optUrl, published: z.boolean() });
export const openingSchema = z.strictObject({ title: s(200).min(3), description: s(4000), eligibility: s(2000), deadline: optDate, contact: s(300), open: z.boolean() });
export const publicationSchema = z.strictObject({
  authors: s(1000).min(2), title: s(500).min(3), venue: s(300), year: z.string().regex(/^(19|20)\d{2}$/, "Year like 2026"),
  type: z.enum(["journal", "conference", "book", "chapter", "patent", "other"]), url: optUrl,
});
export const consentSchema = z.strictObject({ consent: z.boolean() });
export const publicHiddenSchema = z.strictObject({ hidden: z.boolean() });

// ---------- Phase 4 ----------
const litId = z.string().regex(/^[A-Za-z0-9_-]{1,48}$/);
const autoId = z.string().regex(/^[A-Za-z0-9]{1,64}$/);
export const conceptSchema = z.strictObject({
  title: s(160).min(2),
  description: s(2000),
  prerequisites: z.array(autoId).max(20),
  itemIds: z.array(litId).max(30),
});
export const conceptAssignSchema = z.strictObject({ uids: z.array(uid).min(1).max(50) });
export const noteSchema = z.strictObject({
  definition: s(3000),
  explanation: s(8000),
  equations: s(3000),
  example: s(5000),
  usedIn: s(2000),
  paperIds: z.array(litId).max(20),
  figures: z.array(z.strictObject({ path: storagePath, name: s(200) })).max(6),
});
export const noteReviewSchema = z.strictObject({ action: z.enum(["accept", "revise", "applied"]), comment: s(2000) });

const sessionType = z.enum(["batch_digest", "concept_talk", "paper", "prototype_demo", "writing", "pitch", "rehearsal", "other"]);
const speakerIn = z.strictObject({ uid, topic: s(300), conceptId: z.union([autoId, z.literal("")]), projectId: z.union([id, z.literal("")]) });
export const sessionSchema = z.strictObject({
  title: s(200).min(2),
  type: sessionType,
  date: isoDate,
  time: z.string().regex(/^(\d{2}:\d{2})?$/),
  venue: s(300),
  peerScoring: z.boolean(),
  speakers: z.array(speakerIn).max(12),
  notes: s(4000),
});
export const rotaSchema = z.strictObject({
  title: s(160).min(2),
  type: sessionType,
  startDate: isoDate,
  everyDays: z.number().int().min(1).max(60),
  count: z.number().int().min(1).max(52),
  perSession: z.number().int().min(1).max(8),
  time: z.string().regex(/^(\d{2}:\d{2})?$/),
  venue: s(300),
  uids: z.array(uid).min(1).max(60),
  peerScoring: z.boolean(),
});
export const sessionRunSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("attendance"), attendance: z.record(uid, z.enum(["present", "absent", "excused"])) }),
  z.strictObject({ action: z.literal("question"), byUid: uid, toUid: uid, text: s(500).min(3) }),
  z.strictObject({ action: z.literal("action_item"), text: s(300).min(3), ownerUid: uid, due: optDate }),
  z.strictObject({ action: z.literal("status"), status: z.enum(["scheduled", "completed", "cancelled"]) }),
  z.strictObject({ action: z.literal("spot_check"), perSpeaker: z.number().int().min(1).max(5) }),
  z.strictObject({ action: z.literal("notes"), notes: s(4000) }),
]);
export const slidesSchema = z.strictObject({ path: storagePath });
const r = z.number().int().min(1).max(5);
export const scoreSchema = z.strictObject({ speakerUid: uid, scores: z.strictObject({ clarity: r, depth: r, critical: r, qa: r }), comment: s(1000) });
export const taskSchema = z.strictObject({ uid, title: s(300).min(3), due: optDate });
export const taskDoneSchema = z.strictObject({ done: z.boolean() });

// ---------- Phase 5: Outputs & Prototypes ----------
const outputKind = z.enum(["publication", "patent", "product", "software", "dataset", "thesis_chapter"]);
const year = z.string().regex(/^((19|20)\d{2})?$/, "Year like 2026");
const fileIn = z.strictObject({ path: storagePath, name: s(200).min(1) });
const outputFields = {
  subtype: s(60),
  title: s(500).min(3),
  authors: s(1500),
  memberUids: z.array(uid).max(20),
  projectId: z.union([autoId, z.literal("")]),
  venue: s(300),
  year,
  identifier: s(200),
  url: optUrl,
  date: optDate,
  trl: z.number().int().min(0).max(9),
  notes: s(4000),
  publicSummary: s(1000),
};
export const outputCreateSchema = z.strictObject({ kind: outputKind, ...outputFields });
export const outputPatchSchema = z.strictObject(outputFields).partial().extend({ public: z.boolean().optional(), archived: z.boolean().optional() });
export const outputStatusSchema = z.strictObject({ status: z.string().regex(/^[a-z_]{2,30}$/), note: s(1000), date: optDate });
export const outputFileSchema = z.strictObject({ file: fileIn });

const stageName = s(80).min(2);
export const prototypeCreateSchema = z.strictObject({
  title: s(200).min(3),
  goal: s(2000),
  ownerUids: z.array(uid).min(1).max(10),
  stages: z.array(stageName).min(1).max(12),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const bomItem = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9]{1,24}$/),
  item: s(200).min(1),
  qty: z.number().int().min(1).max(100000),
  unitCost: z.number().min(0).max(100000000),
  supplier: s(200),
  status: z.enum(["needed", "ordered", "received"]),
});
export const prototypePatchSchema = z
  .strictObject({
    title: s(200).min(3),
    goal: s(2000),
    ownerUids: z.array(uid).min(1).max(10),
    bom: z.array(bomItem).max(300),
    currency: z.string().regex(/^[A-Z]{3}$/),
    demoUrl: optUrl,
    repoUrl: optUrl,
    trl: z.number().int().min(0).max(9),
    status: z.enum(["active", "paused", "done"]),
    outputId: z.union([autoId, z.literal("")]),
  })
  .partial();
export const stageSubmitSchema = z.strictObject({ index: z.number().int().min(0).max(11), evidence: s(4000).min(10, "Describe the evidence (at least 10 characters)"), files: z.array(fileIn).max(10) });
export const stageReviewSchema = z.strictObject({ index: z.number().int().min(0).max(11), decision: z.enum(["approved", "revise", "reopen"]), comment: s(2000) });
export const logEntrySchema = z.strictObject({ date: isoDate, text: s(4000).min(5), hours: z.number().min(0).max(24), files: z.array(fileIn).max(5) });

// ---------- Phase 6: My Office ----------
const hhmm = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time like 09:30"), z.literal("")]);
const officePath = z.string().regex(/^office\/[A-Za-z0-9]{1,128}\/[A-Za-z0-9._-]{1,200}$/, "Invalid file");
const officeFile = z.strictObject({ path: officePath, name: s(200).min(1), at: z.number().int().nonnegative(), by: uid });
const files = z.array(officeFile).max(30);
const label = s(120).min(1);
const labelList = (min: number, max: number) => z.array(label).min(min).max(max).refine((l) => new Set(l.map((x) => x.toLowerCase())).size === l.length, "Duplicate entries");
const cats = z.array(label).max(15);
const shortId = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const officeSettingsSchema = z.strictObject({
  recordCategories: labelList(1, 80),
  levels: labelList(0, 20),
  orderTypes: labelList(1, 40),
  meetingTypes: labelList(1, 40),
  cvSections: z.array(z.strictObject({ id: shortId, title: label })).min(1).max(40).refine((l) => new Set(l.map((x) => x.id)).size === l.length, "Duplicate section ids"),
  reminderDays: z.array(z.number().int().min(0).max(60)).max(6),
  diaryMinutes: z.number().int().min(15).max(240),
});

const slot = z.strictObject({ day: z.number().int().min(0).max(6), start: hhmm, end: hhmm, room: s(60) });
const subject = z.strictObject({
  id: shortId, code: s(30), name: s(200).min(2), programme: s(120), kind: z.enum(["theory", "lab", "tutorial"]),
  units: z.number().int().min(0).max(30), slots: z.array(slot).max(14),
});
export const semesterSchema = z.strictObject({
  name: s(80).min(2), startDate: isoDate, endDate: optDate, active: z.boolean(),
  subjects: z.array(subject).max(30).refine((l) => new Set(l.map((x) => x.id)).size === l.length, "Duplicate subject ids"),
});

export const diarySchema = z.strictObject({
  date: isoDate, start: hhmm, end: hhmm, type: z.enum(["lecture", "lab", "tutorial", "meeting", "duty", "other"]),
  semesterId: z.union([autoId, z.literal("")]), subjectId: z.union([shortId, z.literal("")]),
  room: s(60), unit: s(60), topic: s(1000), remark: s(1000), students: z.number().int().min(0).max(2000),
});
export const meetingSchema = z.strictObject({
  date: isoDate, time: hhmm, title: s(300).min(2), type: s(120), chair: s(200), venue: s(200), attendees: s(2000),
  agenda: s(4000), keyPoints: s(8000), decisions: s(4000), files,
});
export const dutySchema = z.strictObject({
  title: s(300).min(2), details: s(4000), assignedBy: s(200), assignedOn: optDate, deadline: optDate,
  remindDays: z.array(z.number().int().min(0).max(60)).max(6), status: z.enum(["open", "done", "dropped"]), doneOn: optDate,
  outcome: s(2000), categories: cats,
  source: z.strictObject({ type: z.enum(["", "order", "meeting"]), id: z.union([autoId, z.literal("")]), label: s(300) }), files,
});
export const orderSchema = z.strictObject({
  number: s(120), date: isoDate, type: s(120), title: s(500).min(2), issuedBy: s(200), mention: s(4000),
  validFrom: optDate, validTo: optDate, categories: cats, files,
});
export const recordSchema = z.strictObject({
  title: s(500).min(2), categories: cats.min(1, "Choose at least one category"), date: isoDate, endDate: optDate, level: s(120), role: s(200),
  organisation: s(300), details: s(4000), amount: s(60), url: optUrl, cvSection: z.union([shortId, z.literal("")]), files,
});
const cvEntry = z.strictObject({ title: s(300), place: s(300), from: s(20), to: s(20), note: s(1000) });
export const cvSchema = z.strictObject({
  name: s(200), designation: s(200), department: s(200), institution: s(300), email: z.union([z.string().email().max(200), z.literal("")]),
  phone: s(40), address: s(500), orcid: s(40), scholarUrl: optUrl, website: optUrl, summary: s(3000), researchInterests: s(1500),
  education: z.array(cvEntry).max(20), experience: z.array(cvEntry).max(40), hiddenSections: z.array(shortId).max(60),
});
export const bundleSchema = z.strictObject({
  title: s(200).min(2), from: optDate, to: optDate, categories: z.array(label).max(80),
  include: z.array(z.enum(["records", "orders", "duties", "meetings"])).min(1),
});
