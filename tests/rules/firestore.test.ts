// Runs against the Firestore + Storage emulators:  npm run test:rules   (also runs in GitHub Actions)
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

let env: RulesTestEnvironment;
const mfa = { firebase: { sign_in_provider: "password" as const, sign_in_second_factor: "totp" } };
const as = {
  supervisor: () => env.authenticatedContext("sup", { role: "supervisor", active: true, ...mfa }).firestore(),
  supervisorNo2fa: () => env.authenticatedContext("sup", { role: "supervisor", active: true }).firestore(),
  mentor: () => env.authenticatedContext("men", { role: "mentor", active: true, ...mfa }).firestore(),
  mentorNo2fa: () => env.authenticatedContext("men", { role: "mentor", active: true }).firestore(),
  scholarA: () => env.authenticatedContext("A", { role: "scholar", active: true }).firestore(),
  scholarB: () => env.authenticatedContext("B", { role: "scholar", active: true }).firestore(),
  disabledA: () => env.authenticatedContext("A", { role: "scholar", active: false }).firestore(),
  fakeRole: () => env.authenticatedContext("X", { role: "supervisor", active: true }).firestore(),
  anon: () => env.unauthenticatedContext().firestore(),
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-scholar-lab",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "settings/lab"), { labName: "Lab" });
    await setDoc(doc(db, "publicSite/info"), { labName: "Lab" });
    await setDoc(doc(db, "users/A"), { uid: "A", role: "scholar", mustChangePassword: true });
    await setDoc(doc(db, "users/men"), { uid: "men", role: "mentor" });
    await setDoc(doc(db, "scholars/A"), { uid: "A", mentorUids: ["men"], name: "A" });
    await setDoc(doc(db, "scholars/B"), { uid: "B", mentorUids: [], name: "B" });
    await setDoc(doc(db, "scholars/A/milestones/m1"), { uid: "A", mentorUids: ["men"], title: "x" });
    await setDoc(doc(db, "scholars/B/milestones/m1"), { uid: "B", mentorUids: [], title: "y" });
    await setDoc(doc(db, "presence/A_2026-11-09"), { uid: "A", mentorUids: ["men"], date: "2026-11-09" });
    await setDoc(doc(db, "presence/B_2026-11-09"), { uid: "B", mentorUids: [], date: "2026-11-09" });
    await setDoc(doc(db, "leaves/l1"), { uid: "A", mentorUids: ["men"], status: "pending" });
    await setDoc(doc(db, "scholarNotes/A"), { notes: "private" });
    await setDoc(doc(db, "auditLog/e1"), { action: "x" });
    await setDoc(doc(db, "projects/P1"), { id: "P1", scholarUids: ["A", "B"], mentorUids: ["men"], cardsVisibleToGroup: false });
    await setDoc(doc(db, "projects/P2"), { id: "P2", scholarUids: ["B"], mentorUids: [], cardsVisibleToGroup: false });
    await setDoc(doc(db, "projects/P1/literature/L1"), { id: "L1", title: "t", url: "https://x.org" });
    await setDoc(doc(db, "projects/P2/literature/L1"), { id: "L1", title: "t", url: "https://x.org" });
    await setDoc(doc(db, "projects/P1/plans/A"), { uid: "A", batches: [] });
    await setDoc(doc(db, "projects/P1/plans/B"), { uid: "B", batches: [] });
    await setDoc(doc(db, "readingCards/P1_A_L1"), { uid: "A", mentorUids: ["men"], groupUids: [], projectId: "P1", status: "accepted" });
    await setDoc(doc(db, "readingCards/P1_B_L1"), { uid: "B", mentorUids: [], groupUids: ["A", "B"], projectId: "P1", status: "accepted" });
    await setDoc(doc(db, "outputs/O1"), { id: "O1", memberUids: ["A"], mentorUids: ["men"], updatedAt: 1 });
    await setDoc(doc(db, "outputs/O2"), { id: "O2", memberUids: ["B"], mentorUids: [], updatedAt: 1 });
    await setDoc(doc(db, "projects/P1/prototypes/R1"), { id: "R1", ownerUids: ["A"] });
    await setDoc(doc(db, "projects/P1/prototypes/R1/log/E1"), { uid: "A", text: "x" });
    await setDoc(doc(db, "projects/P2/prototypes/R2"), { id: "R2", ownerUids: ["B"] });
    for (const c of ["officeDiary", "officeMeetings", "officeDuties", "officeOrders", "officeRecords", "officeSemesters", "officeSettings", "officeCv"]) await setDoc(doc(db, `${c}/x`), { id: "x" });
    await setDoc(doc(db, "fileIndex/k"), { path: "p", type: "output", id: "O1" });
    await setDoc(doc(db, "readingCards/P1_B_L2"), { uid: "B", mentorUids: [], groupUids: ["A", "B"], projectId: "P1", status: "submitted" });
  });
});

describe("no client writes anywhere", () => {
  it("even the supervisor cannot write directly", async () => {
    await assertFails(setDoc(doc(as.supervisor(), "scholars/A"), { name: "hacked" }, { merge: true }));
    await assertFails(setDoc(doc(as.supervisor(), "auditLog/new"), { action: "fake" }));
    await assertFails(setDoc(doc(as.scholarA(), "presence/A_2026-11-10"), { uid: "A", mentorUids: [] }));
    await assertFails(setDoc(doc(as.scholarA(), "users/A"), { role: "supervisor" }, { merge: true }));
  });
});

describe("public data", () => {
  it("anyone can read publicSite; nothing else", async () => {
    await assertSucceeds(getDoc(doc(as.anon(), "publicSite/info")));
    await assertFails(getDoc(doc(as.anon(), "settings/lab")));
    await assertFails(getDoc(doc(as.anon(), "scholars/A")));
  });
});

describe("scholar isolation", () => {
  it("scholar reads own records only", async () => {
    await assertSucceeds(getDoc(doc(as.scholarA(), "scholars/A")));
    await assertFails(getDoc(doc(as.scholarA(), "scholars/B")));
    await assertSucceeds(getDocs(query(collection(as.scholarA(), "presence"), where("uid", "==", "A"))));
    await assertFails(getDocs(collection(as.scholarA(), "presence")));
    await assertFails(getDocs(query(collection(as.scholarA(), "presence"), where("uid", "==", "B"))));
    await assertSucceeds(getDocs(query(collection(as.scholarA(), "scholars/A/milestones"), where("uid", "==", "A"))));
    await assertSucceeds(getDocs(query(collection(as.scholarA(), "scholars/A/documents"), where("uid", "==", "A"))));
    await assertFails(getDocs(collection(as.scholarA(), "scholars/A/milestones"))); // unscoped list is not provable
    await assertFails(getDocs(query(collection(as.scholarA(), "scholars/B/milestones"), where("uid", "==", "B"))));
    await assertFails(getDocs(collectionGroup(as.scholarA(), "milestones")));
  });
  it("scholar cannot read private notes, audit log, other users", async () => {
    await assertFails(getDoc(doc(as.scholarA(), "scholarNotes/A")));
    await assertFails(getDocs(collection(as.scholarA(), "auditLog")));
    await assertFails(getDoc(doc(as.scholarA(), "users/men")));
    await assertSucceeds(getDoc(doc(as.scholarA(), "users/A")));
  });
  it("disabled accounts read nothing but their own user doc", async () => {
    await assertFails(getDoc(doc(as.disabledA(), "scholars/A")));
    await assertFails(getDoc(doc(as.disabledA(), "settings/lab")));
  });
});

describe("mentor scope", () => {
  it("mentor sees only assigned scholars", async () => {
    await assertSucceeds(getDoc(doc(as.mentor(), "scholars/A")));
    await assertFails(getDoc(doc(as.mentor(), "scholars/B")));
    await assertSucceeds(getDocs(query(collection(as.mentor(), "scholars"), where("mentorUids", "array-contains", "men"))));
    await assertFails(getDocs(collection(as.mentor(), "scholars")));
    await assertSucceeds(getDocs(query(collectionGroup(as.mentor(), "milestones"), where("mentorUids", "array-contains", "men"))));
    await assertSucceeds(getDocs(query(collection(as.mentor(), "leaves"), where("mentorUids", "array-contains", "men"))));
    await assertFails(getDoc(doc(as.mentor(), "scholarNotes/A")));
    await assertFails(getDocs(collection(as.mentor(), "auditLog")));
  });
  it("app query shapes used by mentors are allowed; unscoped ones are not", async () => {
    const db = as.mentor();
    await assertSucceeds(getDocs(query(collection(db, "presence"), where("uid", "==", "A"), where("mentorUids", "array-contains", "men"))));
    await assertFails(getDocs(query(collection(db, "presence"), where("uid", "==", "A"))));
    await assertSucceeds(getDocs(query(collection(db, "scholars/A/milestones"), where("mentorUids", "array-contains", "men"))));
    await assertFails(getDocs(collection(db, "scholars/A/milestones")));
    // Scoped query on an unassigned scholar is allowed but returns nothing.
    const other = await assertSucceeds(getDocs(query(collection(db, "scholars/B/milestones"), where("mentorUids", "array-contains", "men"))));
    if (!other.empty) throw new Error("mentor saw an unassigned scholar's milestones");
  });
  it("mentor without 2FA sees nothing", async () => {
    await assertFails(getDoc(doc(as.mentorNo2fa(), "scholars/A")));
    await assertSucceeds(getDoc(doc(as.mentorNo2fa(), "users/men")));
  });
});

describe("supervisor", () => {
  it("reads everything with 2FA", async () => {
    await assertSucceeds(getDocs(collection(as.supervisor(), "scholars")));
    await assertSucceeds(getDocs(collectionGroup(as.supervisor(), "milestones")));
    await assertSucceeds(getDoc(doc(as.supervisor(), "scholarNotes/A")));
    await assertSucceeds(getDocs(collection(as.supervisor(), "auditLog")));
  });
  it("without 2FA reads nothing sensitive", async () => {
    await assertFails(getDocs(collection(as.supervisorNo2fa(), "scholars")));
    await assertFails(getDocs(collection(as.fakeRole(), "auditLog")));
  });
});

describe("projects & reading cards", () => {
  it("project members only; literature follows project membership", async () => {
    await assertSucceeds(getDoc(doc(as.scholarA(), "projects/P1")));
    await assertFails(getDoc(doc(as.scholarA(), "projects/P2")));
    await assertSucceeds(getDocs(collection(as.scholarA(), "projects/P1/literature")));
    await assertFails(getDocs(collection(as.scholarA(), "projects/P2/literature")));
    await assertSucceeds(getDocs(query(collection(as.scholarA(), "projects"), where("scholarUids", "array-contains", "A"))));
    await assertSucceeds(getDocs(collection(as.mentor(), "projects/P1/literature")));
    await assertFails(getDocs(collection(as.mentor(), "projects/P2/literature")));
  });
  it("plans: scholar sees only own plan", async () => {
    await assertSucceeds(getDoc(doc(as.scholarA(), "projects/P1/plans/A")));
    await assertFails(getDoc(doc(as.scholarA(), "projects/P1/plans/B")));
  });
  it("cards: group sees only accepted cards that the supervisor opened", async () => {
    await assertSucceeds(getDoc(doc(as.scholarA(), "readingCards/P1_A_L1")));
    await assertSucceeds(getDoc(doc(as.scholarA(), "readingCards/P1_B_L1"))); // opened to group, accepted
    await assertFails(getDoc(doc(as.scholarA(), "readingCards/P1_B_L2"))); // not accepted yet
    await assertSucceeds(getDocs(query(collection(as.scholarA(), "readingCards"), where("projectId", "==", "P1"), where("groupUids", "array-contains", "A"), where("status", "==", "accepted"))));
    await assertFails(getDocs(query(collection(as.scholarA(), "readingCards"), where("projectId", "==", "P1"))));
    await assertFails(setDoc(doc(as.scholarA(), "readingCards/P1_A_L9"), { uid: "A", status: "accepted" }));
  });
});

describe("concepts & seminars", () => {
  it("concept notes: own, mentor, supervisor; group only when accepted and opened", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const d = c.firestore();
      await setDoc(doc(d, "projects/P1/concepts/C1"), { id: "C1", title: "x", prerequisites: [] });
      await setDoc(doc(d, "conceptNotes/P1_A_C1"), { uid: "A", mentorUids: ["men"], groupUids: [], status: "submitted", projectId: "P1" });
      await setDoc(doc(d, "conceptNotes/P1_B_C1"), { uid: "B", mentorUids: [], groupUids: ["A", "B"], status: "accepted", projectId: "P1" });
      await setDoc(doc(d, "sessions/S1"), { id: "S1", speakerUids: ["A"] });
      await setDoc(doc(d, "sessionScores/S1_A_x"), { uid: "A", mentorUids: ["men"], sessionId: "S1" });
      await setDoc(doc(d, "tasks/T1"), { uid: "A", mentorUids: [] });
    });
    await assertSucceeds(getDocs(collection(as.scholarA(), "projects/P1/concepts")));
    await assertFails(getDocs(collection(as.scholarA(), "projects/P2/concepts")));
    await assertSucceeds(getDoc(doc(as.scholarA(), "conceptNotes/P1_A_C1")));
    await assertSucceeds(getDoc(doc(as.scholarA(), "conceptNotes/P1_B_C1")));
    await assertFails(getDoc(doc(as.scholarB(), "conceptNotes/P1_A_C1")));
    await assertSucceeds(getDoc(doc(as.mentor(), "conceptNotes/P1_A_C1")));
    await assertSucceeds(getDoc(doc(as.scholarB(), "sessions/S1")));
    await assertFails(getDoc(doc(as.anon(), "sessions/S1")));
    await assertSucceeds(getDoc(doc(as.scholarA(), "sessionScores/S1_A_x")));
    await assertFails(getDoc(doc(as.scholarB(), "sessionScores/S1_A_x")));
    await assertFails(getDoc(doc(as.scholarB(), "tasks/T1")));
    await assertFails(setDoc(doc(as.scholarA(), "tasks/T1"), { uid: "A", mentorUids: [], done: true }));
  });
});

describe("outputs & prototypes", () => {
  it("scholars see only outputs they are members of; list queries must be scoped", async () => {
    await assertSucceeds(getDoc(doc(as.scholarA(), "outputs/O1")));
    await assertFails(getDoc(doc(as.scholarA(), "outputs/O2")));
    await assertSucceeds(getDocs(query(collection(as.scholarA(), "outputs"), where("memberUids", "array-contains", "A"))));
    await assertFails(getDocs(collection(as.scholarA(), "outputs")));
  });
  it("mentors see their mentees' outputs only; supervisor sees all", async () => {
    await assertSucceeds(getDoc(doc(as.mentor(), "outputs/O1")));
    await assertFails(getDoc(doc(as.mentor(), "outputs/O2")));
    await assertSucceeds(getDocs(query(collection(as.mentor(), "outputs"), where("mentorUids", "array-contains", "men"))));
    await assertSucceeds(getDocs(collection(as.supervisor(), "outputs")));
    await assertFails(getDoc(doc(as.mentorNo2fa(), "outputs/O1")));
  });
  it("prototypes and logbooks follow project membership", async () => {
    await assertSucceeds(getDoc(doc(as.scholarB(), "projects/P1/prototypes/R1")));
    await assertSucceeds(getDocs(collection(as.scholarB(), "projects/P1/prototypes/R1/log")));
    await assertFails(getDoc(doc(as.scholarA(), "projects/P2/prototypes/R2")));
    await assertFails(getDocs(collection(as.mentor(), "projects/P2/prototypes")));
    await assertFails(getDoc(doc(as.anon(), "projects/P1/prototypes/R1")));
  });
  it("no client writes; file index is server-only", async () => {
    await assertFails(setDoc(doc(as.supervisor(), "outputs/O1"), { status: "published" }));
    await assertFails(setDoc(doc(as.scholarA(), "projects/P1/prototypes/R1/log/E2"), { text: "x" }));
    await assertFails(getDoc(doc(as.supervisor(), "fileIndex/k")));
  });
});

describe("my office (supervisor-private)", () => {
  const C = ["officeDiary", "officeMeetings", "officeDuties", "officeOrders", "officeRecords", "officeSemesters", "officeSettings", "officeCv"];
  it("only the supervisor (with 2FA) can read", async () => {
    for (const c of C) {
      await assertSucceeds(getDoc(doc(as.supervisor(), `${c}/x`)));
      await assertSucceeds(getDocs(collection(as.supervisor(), c)));
      await assertFails(getDoc(doc(as.mentor(), `${c}/x`)));
      await assertFails(getDoc(doc(as.scholarA(), `${c}/x`)));
      await assertFails(getDocs(collection(as.scholarA(), c)));
      await assertFails(getDoc(doc(as.anon(), `${c}/x`)));
      await assertFails(getDoc(doc(as.supervisorNo2fa(), `${c}/x`)));
    }
  });
  it("no browser writes, even by the supervisor", async () => {
    await assertFails(setDoc(doc(as.supervisor(), "officeDiary/y"), { topic: "x" }));
    await assertFails(setDoc(doc(as.supervisor(), "officeRecords/x"), { title: "x" }));
  });
});

describe("public website", () => {
  it("anyone reads public mirrors; nobody writes; private sources supervisor-only", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "publicPeople/A"), { name: "A" });
      await setDoc(doc(c.firestore(), "siteNews/n1"), { title: "draft", published: false });
    });
    await assertSucceeds(getDoc(doc(as.anon(), "publicPeople/A")));
    await assertSucceeds(getDocs(collection(as.anon(), "publicNews")));
    await assertFails(setDoc(doc(as.anon(), "publicNews/x"), { title: "spam" }));
    await assertFails(setDoc(doc(as.supervisor(), "publicPeople/X"), { name: "x" }));
    await assertFails(getDoc(doc(as.anon(), "siteNews/n1")));
    await assertFails(getDoc(doc(as.scholarA(), "siteNews/n1")));
    await assertSucceeds(getDoc(doc(as.supervisor(), "siteNews/n1")));
  });
});

describe("storage", () => {
  const pdf = new Uint8Array([37, 80, 68, 70]);
  const st = (uid: string, claims: Record<string, unknown>) => env.authenticatedContext(uid, claims).storage();
  it("scholar uploads only into own folder, only PDFs/images under 10 MB", async () => {
    await assertSucceeds(uploadBytes(ref(st("A", { role: "scholar", active: true }), "scholars/A/uploads/1-a.pdf"), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(st("A", { role: "scholar", active: true }), "scholars/B/uploads/1-a.pdf"), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(st("A", { role: "scholar", active: true }), "scholars/A/uploads/x.html"), pdf, { contentType: "text/html" }));
  });
  it("nobody reads files directly (signed links only)", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await uploadBytes(ref(c.storage(), "scholars/A/uploads/doc.pdf"), pdf, { contentType: "application/pdf" });
    });
    await assertFails(getBytes(ref(st("A", { role: "scholar", active: true }), "scholars/A/uploads/doc.pdf")));
    await assertFails(getBytes(ref(st("sup", { role: "supervisor", active: true, ...mfa }), "scholars/A/uploads/doc.pdf")));
  });
});
