// Shared data shapes. Dates are stored as "YYYY-MM-DD" strings; instants as epoch milliseconds.

export type Role = "supervisor" | "mentor" | "scholar" | "alumni";
export type Level = "bachelor" | "master" | "phd";

export interface Programme {
  id: string;
  name: string;
  level: Level;
}

export interface LeaveType {
  id: string;
  name: string;
  yearlyQuota: number; // 0 = no limit
}

export interface LabSettings {
  labName: string;
  institution: string;
  department: string;
  supervisorName: string;
  tagline: string;
  accent: string; // hex colour
  timezone: string; // IANA, e.g. Asia/Kolkata
  programmes: Programme[];
  leaveTypes: LeaveType[];
  holidays: string[]; // YYYY-MM-DD
  weekendDays: number[]; // 0 = Sunday ... 6 = Saturday
  mentorCanApproveLeave: boolean;
  mentorCanCorrectPresence: boolean;
  geofence: { enabled: boolean; lat: number; lng: number; radiusM: number };
  idleMinutes: number;
  statuses: string[]; // enrolment statuses
}

export interface MilestoneTemplateItem {
  key: string;
  title: string;
  weight: number;
  offsetMonths: number; // due date = joining date + offset
  repeatEveryMonths?: number; // for recurring reviews (e.g. six-monthly)
  repeatCount?: number;
}

export interface MilestoneTemplate {
  programmeId: string;
  items: MilestoneTemplateItem[];
}

export type MilestoneStatus = "not_started" | "in_progress" | "submitted" | "approved" | "waived";

export interface Milestone {
  id: string;
  uid: string;
  mentorUids: string[];
  title: string;
  weight: number;
  order: number;
  dueDate: string;
  status: MilestoneStatus;
  completedOn: string | null;
  scholarNote: string;
  remarks: string;
  approvedBy: string | null;
  evidence: { path: string; name: string }[];
  updatedAt: number;
}

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled" | "pending_deletion";
  mustChangePassword: boolean;
  createdAt: number;
}

export interface Qualification {
  degree: string;
  institute: string;
  year: string;
  score: string;
}

export interface ScholarDoc {
  uid: string;
  mentorUids: string[];
  name: string;
  email: string;
  phone: string;
  photoPath: string;
  emergencyContact: string;
  address: string;
  enrolmentNo: string;
  programmeId: string;
  specialisation: string;
  batch: string;
  joiningDate: string;
  mode: "full_time" | "part_time";
  status: string;
  researchTopic: string;
  expectedCompletion: string;
  // PhD / research-degree extras (optional for others)
  funding: string;
  fundingFrom: string;
  fundingTo: string;
  coSupervisor: string;
  committeeMembers: string;
  proposalApprovedOn: string;
  minDurationMonths: number;
  maxDurationMonths: number;
  extensions: string;
  qualifications: Qualification[];
  deletion: { scheduledAt: number; purgeAfter: number; keepMinimal: boolean } | null;
  publicConsent?: boolean; // the scholar agreed to appear on the public website
  publicHidden?: boolean; // the supervisor chose not to show them
  createdAt: number;
  updatedAt: number;
}

export interface PresenceDoc {
  uid: string;
  mentorUids: string[];
  date: string;
  checkIn: number | null;
  checkOut: number | null;
  insideCampus: boolean | null;
  status: "present" | "absent" | "on_leave" | "holiday";
  corrected: { by: string; at: number; reason: string } | null;
}

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveDoc {
  id: string;
  uid: string;
  mentorUids: string[];
  scholarName: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  documentPath: string | null;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: number | null;
  decisionRemark: string;
  createdAt: number;
}

export interface DocumentMeta {
  id: string;
  uid: string;
  mentorUids: string[];
  title: string;
  category: string;
  path: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
}

export interface AuditEntry {
  actorUid: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  at: number;
}

// ---------- Phase 2: projects & literature ----------

export type ReleaseMode = "date" | "gated" | "both";
export type LitType = "review" | "primary" | "patent" | "standard" | "datasheet" | "tutorial" | "other";
export type LitPriority = "core" | "supporting" | "optional";

export interface ProjectDoc {
  id: string;
  title: string;
  objectives: string;
  status: "planned" | "active" | "on_hold" | "completed" | "closed";
  startDate: string;
  endDate: string;
  scholarUids: string[];
  mentorUids: string[]; // union of the assigned scholars' mentors (kept in sync by the server)
  releaseMode: ReleaseMode;
  gateThreshold: number; // 0.5–1, share of previous batch accepted
  minWords: number; // minimum words in key Reading Card fields
  cardsVisibleToGroup: boolean;
  publicVisible?: boolean;
  publicSummary?: string;
  itemCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface LitItem {
  id: string; // stable id (from CSV "id" or generated)
  title: string;
  authors: string;
  year: string;
  venue: string;
  url: string;
  type: LitType;
  priority: LitPriority;
  theme: string;
  estMinutes: number;
  orderHint: number;
  addedAt: number;
  source: "csv" | "suggestion";
}

export interface Batch {
  no: number;
  date: string;
  itemIds: string[];
}

export interface PlanDoc {
  uid: string;
  projectId: string;
  mentorUids: string[];
  dailyMinutes: number;
  startDate: string;
  batches: Batch[];
  updatedAt: number;
}

export type CardStatus = "opened" | "submitted" | "accepted" | "revise";

export interface CardFields {
  problem: string;
  method: string;
  setup: string;
  keyResult: string;
  limitations: string;
  concepts: string[];
  relevance: number;
  citableClaim: string;
}

export interface ReadingCard extends Partial<CardFields> {
  id: string;
  projectId: string;
  itemId: string;
  itemTitle: string;
  uid: string;
  scholarName: string;
  mentorUids: string[];
  groupUids: string[]; // filled only while the supervisor has opened cards to the group
  status: CardStatus;
  openedAt: number | null;
  submittedAt: number | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  reviewComment: string;
  history: { at: number; status: CardStatus; by: string; comment?: string }[];
}

export interface Suggestion {
  id: string;
  uid: string;
  scholarName: string;
  title: string;
  url: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

// ---------- Phase 3: public website ----------

export interface SiteContent {
  about: string;
  themes: { title: string; summary: string }[];
  piTitle: string;
  piBio: string;
  links: { website: string; orcid: string; scholar: string; scopus: string; linkedin: string };
  contactEmail: string;
  contactPhone: string;
  address: string;
  autoPublishNews: boolean;
  completionStatuses: string[];
}

export interface PublicPerson {
  uid: string;
  name: string;
  group: "current" | "alumni";
  programme: string;
  level: Level;
  topic: string;
  since: string; // year joined
  until: string; // year completed (alumni)
}

export interface PublicProject {
  id: string;
  title: string;
  summary: string;
  status: string;
  startDate: string;
  members: string[];
  updatedAt: number;
}

export interface NewsItem { id: string; title: string; body: string; date: string; link: string; published: boolean; auto: boolean; createdAt: number }
export interface Opening { id: string; title: string; description: string; eligibility: string; deadline: string; contact: string; open: boolean; createdAt: number }
export interface Publication { id: string; authors: string; title: string; venue: string; year: string; type: "journal" | "conference" | "book" | "chapter" | "patent" | "other"; url: string; createdAt: number }

// ---------- Phase 4: concepts & seminars ----------

export type Mastery = "heard" | "explained" | "applied" | "taught";
export type NoteStatus = "claimed" | "submitted" | "accepted" | "revise";

export interface Concept {
  id: string;
  title: string;
  description: string;
  prerequisites: string[];
  itemIds: string[]; // related literature items
  order: number;
  createdAt: number;
}

export interface ConceptNoteFields {
  definition: string;
  explanation: string;
  equations: string;
  example: string;
  usedIn: string;
  paperIds: string[];
}

export interface ConceptNote extends Partial<ConceptNoteFields> {
  id: string;
  projectId: string;
  conceptId: string;
  conceptTitle: string;
  uid: string;
  scholarName: string;
  mentorUids: string[];
  groupUids: string[];
  status: NoteStatus;
  mastery: Mastery;
  figures: { path: string; name: string }[];
  reviewComment: string;
  reviewedBy: string | null;
  history: { at: number; status: NoteStatus | Mastery; by: string; comment?: string }[];
  createdAt: number;
  updatedAt: number;
}

export type SessionType = "batch_digest" | "concept_talk" | "paper" | "prototype_demo" | "writing" | "pitch" | "rehearsal" | "other";

export interface Speaker {
  uid: string;
  name: string;
  topic: string;
  conceptId: string;
  projectId: string;
  slidesPath: string;
  slidesAt: number | null;
  spotCheck: { cardId: string; title: string }[];
}

export interface SessionDoc {
  id: string;
  title: string;
  type: SessionType;
  date: string;
  time: string;
  venue: string;
  peerScoring: boolean;
  speakers: Speaker[];
  speakerUids: string[];
  slidePaths: string[];
  status: "scheduled" | "completed" | "cancelled";
  attendance: Record<string, "present" | "absent" | "excused">;
  questions: { id: string; byUid: string; byName: string; toUid: string; text: string; at: number }[];
  actionItems: { id: string; text: string; ownerUid: string; ownerName: string; due: string; taskId: string }[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Rubric { clarity: number; depth: number; critical: number; qa: number }

export interface ScoreDoc {
  id: string;
  sessionId: string;
  sessionDate: string;
  sessionTitle: string;
  uid: string; // speaker
  mentorUids: string[];
  raterRole: "supervisor" | "mentor" | "peer";
  raterName: string; // shown only for supervisor/mentor ratings
  scores: Rubric;
  comment: string;
  at: number;
}

export interface TaskDoc {
  id: string;
  uid: string;
  mentorUids: string[];
  title: string;
  due: string;
  done: boolean;
  doneAt: number | null;
  source: { type: "session"; id: string; title: string } | { type: "manual"; id: string; title: string };
  createdBy: string;
  createdAt: number;
}

// ---------- Phase 5: Outputs & Prototypes ----------
export type OutputKind = "publication" | "patent" | "product" | "software" | "dataset" | "thesis_chapter";
export interface FileRef { path: string; name: string; at: number; by: string }
export interface OutputDoc {
  id: string;
  kind: OutputKind;
  subtype: string; // publication: journal/conference/book/chapter/other; patent: country or office; free text otherwise
  title: string;
  authors: string; // full author list as printed (lab members and outside co-authors)
  memberUids: string[]; // lab scholars involved
  memberNames: string[];
  mentorUids: string[]; // union of the members' mentors (server-maintained)
  projectId: string;
  projectTitle: string;
  venue: string; // journal / conference / patent office / where deployed
  year: string;
  identifier: string; // DOI, application or patent number, version, ISBN
  url: string;
  date: string; // key date for the current status (submission, filing, acceptance...)
  trl: number; // products/software: 0 = not set
  notes: string;
  status: string;
  public: boolean;
  publicSummary: string;
  archived: boolean;
  files: FileRef[];
  filePaths: string[];
  history: { at: number; from: string; to: string; by: string; byName: string; note: string }[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Stage { name: string; status: "open" | "submitted" | "approved" | "revise"; evidence: string; files: FileRef[]; comment: string; submittedAt: number | null; reviewedAt: number | null; reviewedBy: string }
export interface BomItem { id: string; item: string; qty: number; unitCost: number; supplier: string; status: "needed" | "ordered" | "received" }
export interface PrototypeDoc {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  ownerUids: string[];
  ownerNames: string[];
  stages: Stage[];
  trl: number;
  bom: BomItem[];
  currency: string;
  demoUrl: string;
  repoUrl: string;
  filePaths: string[];
  outputId: string; // linked product/software output, if any
  status: "active" | "paused" | "done";
  createdAt: number;
  updatedAt: number;
}
export interface LogEntry { id: string; date: string; uid: string; name: string; text: string; hours: number; files: FileRef[]; at: number }

// ---------- Phase 6: My Office (supervisor-only) ----------
export interface OfficeSettings {
  recordCategories: string[];
  levels: string[];
  orderTypes: string[];
  meetingTypes: string[];
  cvSections: { id: string; title: string }[];
  reminderDays: number[];
  diaryMinutes: number;
}
export interface Slot { day: number; start: string; end: string; room: string } // day 0 = Sunday
export interface Subject { id: string; code: string; name: string; programme: string; kind: "theory" | "lab" | "tutorial"; units: number; slots: Slot[] }
export interface SemesterDoc { id: string; name: string; startDate: string; endDate: string; active: boolean; subjects: Subject[]; createdAt: number; updatedAt: number }
export type DiaryType = "lecture" | "lab" | "tutorial" | "meeting" | "duty" | "other";
export interface DiaryEntry {
  id: string; date: string; start: string; end: string; type: DiaryType;
  semesterId: string; subjectId: string; subjectLabel: string;
  room: string; unit: string; topic: string; remark: string; students: number;
  createdAt: number; updatedAt: number;
}
export interface MeetingDoc {
  id: string; date: string; time: string; title: string; type: string; chair: string; venue: string; attendees: string;
  agenda: string; keyPoints: string; decisions: string; files: FileRef[]; createdAt: number; updatedAt: number;
}
export interface DutyDoc {
  id: string; title: string; details: string; assignedBy: string; assignedOn: string; deadline: string; remindDays: number[];
  status: "open" | "done" | "dropped"; doneOn: string; outcome: string; categories: string[];
  source: { type: "" | "order" | "meeting"; id: string; label: string }; files: FileRef[]; createdAt: number; updatedAt: number;
}
export interface OrderDoc {
  id: string; number: string; date: string; type: string; title: string; issuedBy: string; mention: string;
  validFrom: string; validTo: string; categories: string[]; files: FileRef[]; createdAt: number; updatedAt: number;
}
export interface RecordDoc {
  id: string; title: string; categories: string[]; date: string; endDate: string; level: string; role: string; organisation: string;
  details: string; amount: string; url: string; cvSection: string; files: FileRef[]; createdAt: number; updatedAt: number;
}
export interface CvEntry { title: string; place: string; from: string; to: string; note: string }
export interface CvProfile {
  name: string; designation: string; department: string; institution: string; email: string; phone: string; address: string;
  orcid: string; scholarUrl: string; website: string; summary: string; researchInterests: string;
  education: CvEntry[]; experience: CvEntry[]; hiddenSections: string[]; updatedAt: number;
}
