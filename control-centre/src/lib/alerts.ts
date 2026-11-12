import type { Lab } from "./types";

const DAY = 86_400_000;
export interface Alert { tone: "bad" | "warn" | "neutral"; text: string }

/** What needs the administrator's attention for a lab. */
export function labAlerts(l: Lab, now: number, stableSha: string | null): Alert[] {
  const a: Alert[] = [];
  if (l.status === "revoked") a.push({ tone: "bad", text: l.readOnlyUntil && now < l.readOnlyUntil ? `Revoked · read-only until ${new Date(l.readOnlyUntil).toLocaleDateString("en-GB")}` : "Revoked · locked" });
  if (l.status === "suspended") a.push({ tone: "warn", text: "Suspended (read-only)" });
  if (!l.licence) a.push({ tone: "warn", text: "No licence issued" });
  else if (l.licence.exp !== null) {
    const days = Math.ceil((l.licence.exp - now) / DAY);
    if (days < 0) a.push({ tone: "bad", text: `Licence expired ${-days} day(s) ago` });
    else if (days <= 30) a.push({ tone: "warn", text: `Licence expires in ${days} day(s)` });
  }
  if (l.licence && l.status !== "revoked") {
    if (!l.lastHeartbeat) a.push({ tone: "warn", text: "Never checked in" });
    else if (now - l.lastHeartbeat.at > 3 * DAY) a.push({ tone: "warn", text: `No check-in for ${Math.floor((now - l.lastHeartbeat.at) / DAY)} days` });
    if (stableSha && l.lastHeartbeat && l.lastHeartbeat.version !== "dev" && !stableSha.startsWith(l.lastHeartbeat.version)) a.push({ tone: "neutral", text: `Running ${l.lastHeartbeat.version}, not the current release` });
  }
  const h = l.handover;
  const pending = [!h.ownerAccepted && "owner acceptance", !h.billingSwitched && "billing switch", !h.adminRemoved && "your removal from Firebase", !h.agreementSigned && "signed agreement"].filter(Boolean);
  if (pending.length) a.push({ tone: "neutral", text: `Handover pending: ${pending.join(", ")}` });
  return a;
}
