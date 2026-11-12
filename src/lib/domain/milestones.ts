import type { Milestone, MilestoneTemplateItem } from "../types";
import { addMonths, daysBetween } from "./dates";

export interface GeneratedMilestone {
  title: string;
  weight: number;
  order: number;
  dueDate: string;
}

/** Expand a programme template into concrete milestones for a scholar joining on `joiningDate`. */
export function generateMilestones(items: MilestoneTemplateItem[], joiningDate: string): GeneratedMilestone[] {
  const out: GeneratedMilestone[] = [];
  for (const item of items) {
    const repeat = item.repeatEveryMonths && item.repeatCount ? Math.min(item.repeatCount, 20) : 1;
    for (let i = 0; i < repeat; i++) {
      const offset = item.offsetMonths + (item.repeatEveryMonths ?? 0) * i;
      out.push({
        title: repeat > 1 ? `${item.title} ${i + 1}` : item.title,
        weight: item.weight,
        order: 0,
        dueDate: addMonths(joiningDate, offset),
      });
    }
  }
  out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  out.forEach((m, i) => (m.order = i));
  return out;
}

type MilestoneLite = Pick<Milestone, "weight" | "status" | "dueDate">;

/** Weighted completion % (approved or waived count as done). */
export function degreeProgress(ms: MilestoneLite[]): number {
  const counted = ms.filter((m) => m.status !== "waived");
  const total = counted.reduce((s, m) => s + Math.max(0, m.weight), 0);
  if (total === 0) return ms.length > 0 && ms.every((m) => m.status === "approved" || m.status === "waived") ? 100 : 0;
  const done = counted.filter((m) => m.status === "approved").reduce((s, m) => s + Math.max(0, m.weight), 0);
  return Math.round((done / total) * 100);
}

export function isOverdue(m: MilestoneLite, today: string): boolean {
  return (m.status === "not_started" || m.status === "in_progress") && daysBetween(m.dueDate, today) > 0;
}

export function isDueSoon(m: MilestoneLite, today: string, withinDays = 30): boolean {
  const d = daysBetween(today, m.dueDate);
  return (m.status === "not_started" || m.status === "in_progress") && d >= 0 && d <= withinDays;
}

/** Months of the maximum duration remaining (negative when exceeded). */
export function monthsRemaining(joiningDate: string, maxDurationMonths: number, today: string): number | null {
  if (!joiningDate || !maxDurationMonths) return null;
  const end = addMonths(joiningDate, maxDurationMonths);
  return Math.floor(daysBetween(today, end) / 30.44);
}
