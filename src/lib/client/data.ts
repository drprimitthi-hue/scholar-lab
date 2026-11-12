"use client";
import { collection, collectionGroup, doc, query, where, type Query } from "firebase/firestore";
import { fs } from "./firebase";
import { useLiveDoc, useLiveQuery } from "./hooks";
import { useSession } from "./session";
import type { Concept, ConceptNote, LogEntry, OutputDoc, PrototypeDoc, LeaveDoc, LitItem, Milestone, PlanDoc, PresenceDoc, ProjectDoc, ReadingCard, ScholarDoc, ScoreDoc, SessionDoc, Suggestion, TaskDoc, UserDoc } from "../types";

/**
 * Security rules are not filters: every list query must itself prove it only touches records
 * the caller may read. Mentors are constrained to assigned records, scholars to their own.
 */
function scopeQuery(q: Query, role: string | null, me: string): Query {
  if (role === "mentor") return query(q, where("mentorUids", "array-contains", me));
  if (role === "scholar" || role === "alumni") return query(q, where("uid", "==", me));
  return q;
}

/** Scholars visible to the current user (all for supervisor, mentees for mentor, self for scholar). */
export function useScholars() {
  const s = useSession();
  const uid = s.user?.uid ?? "";
  return useLiveQuery<ScholarDoc>(() => {
    if (!uid || !s.role) return null;
    const c = collection(fs(), "scholars");
    if (s.role === "supervisor") return c;
    if (s.role === "mentor") return query(c, where("mentorUids", "array-contains", uid));
    return query(c, where("uid", "==", uid));
  }, `scholars:${s.role}:${uid}`);
}

/** Milestones visible to the current user across all their scholars. */
export function useAllMilestones() {
  const s = useSession();
  const uid = s.user?.uid ?? "";
  return useLiveQuery<Milestone>(() => {
    if (!uid || !s.role) return null;
    if (s.role === "supervisor") return collectionGroup(fs(), "milestones");
    if (s.role === "mentor") return query(collectionGroup(fs(), "milestones"), where("mentorUids", "array-contains", uid));
    return query(collection(fs(), "scholars", uid, "milestones"), where("uid", "==", uid));
  }, `ms:${s.role}:${uid}`);
}

export function useScholar(uid: string) {
  return useLiveDoc<ScholarDoc>(() => (uid ? doc(fs(), "scholars", uid) : null), `scholar:${uid}`);
}

export function useMilestones(uid: string) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<Milestone>(
    () => (uid && s.role ? scopeQuery(collection(fs(), "scholars", uid, "milestones"), s.role, me) : null),
    `milestones:${uid}:${s.role}`,
  );
}

export function useScholarSub<T>(uid: string, sub: "documents") {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<T>(() => (uid && s.role ? scopeQuery(collection(fs(), "scholars", uid, sub), s.role, me) : null), `${sub}:${uid}:${s.role}`);
}

export function useLeaves(scope: { uid?: string; status?: string }) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<LeaveDoc>(() => {
    if (!me || !s.role) return null;
    const c = collection(fs(), "leaves");
    if (scope.uid) return s.role === "mentor" ? scopeQuery(query(c, where("uid", "==", scope.uid)), s.role, me) : query(c, where("uid", "==", s.role === "supervisor" ? scope.uid : me));
    if (s.role === "supervisor") return scope.status ? query(c, where("status", "==", scope.status)) : c;
    if (s.role === "mentor") return query(c, where("mentorUids", "array-contains", me));
    return query(c, where("uid", "==", me));
  }, `leaves:${s.role}:${me}:${scope.uid ?? ""}:${scope.status ?? ""}`);
}

export function usePresenceOn(date: string) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<PresenceDoc>(() => {
    if (!me || !s.role || !date) return null;
    const c = collection(fs(), "presence");
    if (s.role === "supervisor") return query(c, where("date", "==", date));
    if (s.role === "mentor") return query(c, where("mentorUids", "array-contains", me), where("date", "==", date));
    return query(c, where("uid", "==", me), where("date", "==", date));
  }, `presence:${s.role}:${me}:${date}`);
}

export function usePresenceOf(uid: string, fromDate: string) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<PresenceDoc>(
    () => {
      if (!uid || !s.role) return null;
      const q = query(collection(fs(), "presence"), where("uid", "==", s.role === "supervisor" || s.role === "mentor" ? uid : me), where("date", ">=", fromDate));
      return s.role === "mentor" ? scopeQuery(q, s.role, me) : q;
    },
    `presenceOf:${uid}:${fromDate}:${s.role}`,
  );
}

export function useUsers() {
  const s = useSession();
  return useLiveQuery<UserDoc>(() => (s.role === "supervisor" ? collection(fs(), "users") : null), `users:${s.role}`);
}

// ---------- Phase 2 ----------

export function useProjects() {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<ProjectDoc>(() => {
    if (!me || !s.role) return null;
    const c = collection(fs(), "projects");
    if (s.role === "supervisor") return c;
    if (s.role === "mentor") return query(c, where("mentorUids", "array-contains", me));
    return query(c, where("scholarUids", "array-contains", me));
  }, `projects:${s.role}:${me}`);
}

export function useProject(pid: string) {
  return useLiveDoc<ProjectDoc>(() => (pid ? doc(fs(), "projects", pid) : null), `project:${pid}`);
}

export function useLiterature(pid: string) {
  return useLiveQuery<LitItem>(() => (pid ? collection(fs(), "projects", pid, "literature") : null), `lit:${pid}`);
}

/** All plans of a project (supervisor/mentor) or just the scholar's own. */
export function usePlans(pid: string) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  const all = useLiveQuery<PlanDoc>(
    () => (pid && (s.role === "supervisor" || s.role === "mentor") ? collection(fs(), "projects", pid, "plans") : null),
    `plans:${pid}:${s.role}`,
  );
  const own = useLiveDoc<PlanDoc>(
    () => (pid && me && (s.role === "scholar" || s.role === "alumni") ? doc(fs(), "projects", pid, "plans", me) : null),
    `plan:${pid}:${me}:${s.role}`,
  );
  if (s.role === "scholar" || s.role === "alumni") return { data: own.data ? [own.data] : [], loading: own.loading, error: own.error };
  return all;
}

/** Reading cards visible to the user, optionally narrowed to a project and/or a status. */
export function useCards(opts: { projectId?: string; status?: string }) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<ReadingCard>(() => {
    if (!me || !s.role) return null;
    let q: Query = collection(fs(), "readingCards");
    if (opts.projectId) q = query(q, where("projectId", "==", opts.projectId));
    if (opts.status) q = query(q, where("status", "==", opts.status));
    return scopeQuery(q, s.role, me);
  }, `cards:${s.role}:${me}:${opts.projectId ?? ""}:${opts.status ?? ""}`);
}

/** Accepted cards of other scholars, available only while the supervisor has opened them to the group. */
export function useGroupCards(pid: string, enabled: boolean) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<ReadingCard>(
    () =>
      pid && enabled && s.role === "scholar"
        ? query(collection(fs(), "readingCards"), where("projectId", "==", pid), where("groupUids", "array-contains", me), where("status", "==", "accepted"))
        : null,
    `group:${pid}:${enabled}:${me}`,
  );
}

export function useSuggestions(pid: string) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<Suggestion>(() => {
    if (!pid || !s.role) return null;
    const c = collection(fs(), "projects", pid, "suggestions");
    return s.role === "scholar" || s.role === "alumni" ? query(c, where("uid", "==", me)) : c;
  }, `sugg:${pid}:${s.role}:${me}`);
}

// ---------- Phase 4 ----------
export function useConcepts(pid: string) {
  return useLiveQuery<Concept>(() => (pid ? collection(fs(), "projects", pid, "concepts") : null), `concepts:${pid}`);
}

export function useConceptNotes(opts: { projectId?: string; status?: string; uid?: string }) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<ConceptNote>(() => {
    if (!me || !s.role) return null;
    let q: Query = collection(fs(), "conceptNotes");
    if (opts.projectId) q = query(q, where("projectId", "==", opts.projectId));
    if (opts.status) q = query(q, where("status", "==", opts.status));
    if (opts.uid && s.role === "supervisor") q = query(q, where("uid", "==", opts.uid));
    return scopeQuery(q, s.role, me);
  }, `notes:${s.role}:${me}:${opts.projectId ?? ""}:${opts.status ?? ""}:${opts.uid ?? ""}`);
}

export function useGroupNotes(pid: string, enabled: boolean) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<ConceptNote>(
    () => (pid && enabled && s.role === "scholar" ? query(collection(fs(), "conceptNotes"), where("projectId", "==", pid), where("groupUids", "array-contains", me), where("status", "==", "accepted")) : null),
    `gnotes:${pid}:${enabled}:${me}`,
  );
}

export function useSessions() {
  const s = useSession();
  return useLiveQuery<SessionDoc>(() => (s.user && s.role ? collection(fs(), "sessions") : null), `sessions:${s.role}`);
}

export function useScores(opts: { uid?: string; sessionId?: string }) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<ScoreDoc>(() => {
    if (!me || !s.role) return null;
    let q: Query = collection(fs(), "sessionScores");
    if (opts.sessionId) q = query(q, where("sessionId", "==", opts.sessionId));
    if (opts.uid && s.role === "supervisor") q = query(q, where("uid", "==", opts.uid));
    return scopeQuery(q, s.role, me);
  }, `scores:${s.role}:${me}:${opts.uid ?? ""}:${opts.sessionId ?? ""}`);
}

export function useTasks(opts: { uid?: string }) {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<TaskDoc>(() => {
    if (!me || !s.role) return null;
    let q: Query = collection(fs(), "tasks");
    if (opts.uid && s.role === "supervisor") q = query(q, where("uid", "==", opts.uid));
    return scopeQuery(q, s.role, me);
  }, `tasks:${s.role}:${me}:${opts.uid ?? ""}`);
}

// ---------- Phase 5 ----------
/** Outputs the caller may see (supervisor: all; mentor: mentees'; scholar/alumni: where they are a member). */
export function useOutputs() {
  const s = useSession();
  const me = s.user?.uid ?? "";
  return useLiveQuery<OutputDoc>(() => {
    if (!me || !s.role) return null;
    const c = collection(fs(), "outputs");
    if (s.role === "mentor") return query(c, where("mentorUids", "array-contains", me));
    if (s.role === "scholar" || s.role === "alumni") return query(c, where("memberUids", "array-contains", me));
    return c;
  }, `outputs:${s.role}:${me}`);
}
export const useOutput = (id: string) => useLiveDoc<OutputDoc>(() => (id ? doc(fs(), "outputs", id) : null), `output:${id}`);
export const usePrototypes = (pid: string) => useLiveQuery<PrototypeDoc>(() => (pid ? collection(fs(), "projects", pid, "prototypes") : null), `protos:${pid}`);
export const usePrototype = (pid: string, id: string) => useLiveDoc<PrototypeDoc>(() => (pid && id ? doc(fs(), "projects", pid, "prototypes", id) : null), `proto:${pid}:${id}`);
export const usePrototypeLog = (pid: string, id: string) => useLiveQuery<LogEntry>(() => (pid && id ? collection(fs(), "projects", pid, "prototypes", id, "log") : null), `protolog:${pid}:${id}`);
