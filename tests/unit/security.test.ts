import { describe, expect, it } from "vitest";
import { canAccessScholar, evaluate, type TokenClaims } from "@/lib/server/policy";
import { createUserSchema, enrolmentPatchSchema, leaveApplySchema, milestoneSubmitSchema, settingsSchema } from "@/lib/schemas";
import { DEFAULT_SETTINGS } from "@/lib/domain/defaults";

const now = 1_800_000_000;
const tok = (o: Partial<TokenClaims> & Record<string, unknown>): TokenClaims => ({ uid: "u1", auth_time: now - 10, firebase: {}, ...o });

describe("authorization policy", () => {
  it("rejects tokens without a role or inactive accounts", () => {
    expect(evaluate(tok({}), { roles: ["scholar"] }, now)).toMatchObject({ ok: false, status: 403 });
    expect(evaluate(tok({ role: "scholar", active: false }), { roles: ["scholar"] }, now)).toMatchObject({ ok: false });
    expect(evaluate(tok({ role: "admin", active: true }), { roles: ["supervisor"] }, now)).toMatchObject({ ok: false });
  });
  it("requires 2FA for supervisor and mentor", () => {
    expect(evaluate(tok({ role: "supervisor", active: true }), { roles: ["supervisor"] }, now)).toMatchObject({ ok: false, message: "Two-factor sign-in required" });
    expect(evaluate(tok({ role: "mentor", active: true }), { roles: ["mentor"] }, now)).toMatchObject({ ok: false });
    expect(evaluate(tok({ role: "supervisor", active: true, firebase: { sign_in_second_factor: "totp" } }), { roles: ["supervisor"] }, now)).toMatchObject({ ok: true });
    // account-setup endpoints may skip 2FA
    expect(evaluate(tok({ role: "mentor", active: true }), { roles: ["mentor"], skipMfa: true }, now)).toMatchObject({ ok: true });
  });
  it("scholars cannot use supervisor endpoints", () => {
    expect(evaluate(tok({ role: "scholar", active: true }), { roles: ["supervisor"] }, now)).toMatchObject({ ok: false, status: 403 });
    expect(evaluate(tok({ role: "alumni", active: true }), { roles: ["scholar"] }, now)).toMatchObject({ ok: false });
  });
  it("enforces recent sign-in for sensitive actions", () => {
    const sup = { role: "supervisor", active: true, firebase: { sign_in_second_factor: "totp" } };
    expect(evaluate(tok({ ...sup, auth_time: now - 600 }), { roles: ["supervisor"], recentAuthSeconds: 300 }, now)).toMatchObject({ ok: false, status: 401 });
    expect(evaluate(tok({ ...sup, auth_time: now - 60 }), { roles: ["supervisor"], recentAuthSeconds: 300 }, now)).toMatchObject({ ok: true });
  });
  it("record access: supervisor all, mentor only assigned, scholar only self", () => {
    const sup = { uid: "s", email: "", role: "supervisor" as const, mfa: true, authTime: 0 };
    const men = { ...sup, uid: "m", role: "mentor" as const };
    const sch = { ...sup, uid: "x", role: "scholar" as const };
    expect(canAccessScholar(sup, "x", [])).toBe(true);
    expect(canAccessScholar(men, "x", ["m"])).toBe(true);
    expect(canAccessScholar(men, "x", ["other"])).toBe(false);
    expect(canAccessScholar(sch, "x", [])).toBe(true);
    expect(canAccessScholar(sch, "y", [])).toBe(false);
  });
});

describe("input validation", () => {
  it("rejects unknown keys (no mass-assignment)", () => {
    expect(enrolmentPatchSchema.safeParse({ name: "Asha Rao", role: "supervisor" }).success).toBe(false);
    expect(enrolmentPatchSchema.safeParse({ mentorUids: ["x"] }).success).toBe(false);
    expect(enrolmentPatchSchema.safeParse({ name: "Asha Rao" }).success).toBe(true);
  });
  it("only allows scholar/mentor creation (never supervisor)", () => {
    expect(createUserSchema.safeParse({ role: "supervisor", name: "Eve X", email: "e@x.org" }).success).toBe(false);
    expect(createUserSchema.safeParse({ role: "scholar", name: "Asha Rao", email: "a@x.org", programmeId: "phd" }).success).toBe(true);
  });
  it("blocks path traversal and foreign paths in file references", () => {
    const bad = ["../etc/passwd", "scholars/abc/uploads/../../x.pdf", "scholars/abc/other/x.pdf", "scholars/abc/uploads/a b.pdf"];
    for (const path of bad) expect(milestoneSubmitSchema.safeParse({ scholarNote: "x", evidence: [{ path, name: "x" }] }).success).toBe(false);
    expect(milestoneSubmitSchema.safeParse({ scholarNote: "x", evidence: [{ path: "scholars/abc123/uploads/1-a.pdf", name: "x" }] }).success).toBe(true);
  });
  it("validates dates and lengths", () => {
    expect(leaveApplySchema.safeParse({ type: "casual", from: "2026-13-01", to: "2026-13-02", reason: "abc" }).success).toBe(false);
    expect(leaveApplySchema.safeParse({ type: "casual", from: "2026-11-10", to: "2026-11-11", reason: "x".repeat(1001) }).success).toBe(false);
  });
  it("accepts the default settings and rejects bad colours / time zones", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, accent: "red;}" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, timezone: "Mars/Base" }).success).toBe(false);
  });
});
