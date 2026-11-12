"use client";
import { collection, doc, orderBy, query, where } from "firebase/firestore";
import { fs } from "./firebase";
import { useLiveDoc, useLiveQuery } from "./hooks";
import { useSession } from "./session";
import { DEFAULT_OFFICE } from "../domain/office";
import type { CvProfile, DiaryEntry, DutyDoc, MeetingDoc, OfficeSettings, OrderDoc, RecordDoc, SemesterDoc } from "../types";

/** My Office data is readable by the supervisor only; hooks return nothing for anyone else. */
function useSup() { const s = useSession(); return s.role === "supervisor" && !!s.user; }

export function useOfficeSettings(): OfficeSettings {
  const sup = useSup();
  const { data } = useLiveDoc<Partial<OfficeSettings>>(() => (sup ? doc(fs(), "officeSettings", "main") : null), `oset:${sup}`);
  return { ...DEFAULT_OFFICE, ...(data ?? {}) };
}
const all = <T,>(name: string) => function useAll() {
  const sup = useSup();
  return useLiveQuery<T>(() => (sup ? collection(fs(), name) : null), `${name}:${sup}`);
};
export const useSemesters = all<SemesterDoc>("officeSemesters");
export const useMeetings = all<MeetingDoc>("officeMeetings");
export const useDuties = all<DutyDoc>("officeDuties");
export const useOrders = all<OrderDoc>("officeOrders");
export const useRecords = all<RecordDoc>("officeRecords");
export function useCv() {
  const sup = useSup();
  return useLiveDoc<CvProfile>(() => (sup ? doc(fs(), "officeCv", "main") : null), `cv:${sup}`);
}
/** Diary entries in a date range (inclusive). Empty bounds = open-ended. */
export function useDiary(from: string, to: string) {
  const sup = useSup();
  return useLiveQuery<DiaryEntry>(() => {
    if (!sup) return null;
    const c = collection(fs(), "officeDiary");
    const parts = [...(from ? [where("date", ">=", from)] : []), ...(to ? [where("date", "<=", to)] : []), orderBy("date")];
    return query(c, ...parts);
  }, `diary:${sup}:${from}:${to}`);
}
