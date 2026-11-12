import { describe, expect, it } from "vitest";
import { generateKeys, licenceState, signObject, verifyObject, type LicencePayload, type StatusPayload } from "@shared/licence";

const DAY = 86_400_000;
const keys = generateKeys();
const lic = (o: Partial<LicencePayload> = {}): LicencePayload => ({ v: 1, labId: "lab1", labName: "L", domains: ["a.in"], iat: 0, exp: 100 * DAY, grace: 30, ...o });
const st = (o: Partial<StatusPayload> = {}): StatusPayload => ({ v: 1, labId: "lab1", status: "active", readOnlyUntil: null, message: "", token: null, at: 0, ...o });

describe("licence signing", () => {
  it("round-trips and rejects tampering or wrong keys", () => {
    const t = signObject(lic(), keys.privateKey);
    expect(verifyObject<LicencePayload>(t, keys.publicKey)?.labId).toBe("lab1");
    const [b, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify(lic({ exp: null })), "utf8").toString("base64url");
    expect(verifyObject(`${forged}.${s}`, keys.publicKey)).toBeNull();
    expect(verifyObject(`${b}.${s!.slice(0, -2)}AA`, keys.publicKey)).toBeNull();
    expect(verifyObject(t, generateKeys().publicKey)).toBeNull();
    expect(verifyObject("garbage", keys.publicKey)).toBeNull();
  });
});

describe("licence state", () => {
  it("no licence → locked", () => expect(licenceState(null, null, 0).level).toBe("locked"));
  it("valid → ok; never-expiring → ok", () => {
    expect(licenceState(lic(), null, 50 * DAY).level).toBe("ok");
    expect(licenceState(lic({ exp: null }), null, 9999 * DAY).level).toBe("ok");
  });
  it("expired → read-only during grace, then locked", () => {
    expect(licenceState(lic(), null, 110 * DAY).level).toBe("readonly");
    expect(licenceState(lic(), null, 131 * DAY).level).toBe("locked");
  });
  it("suspended → read-only; revoked → read-only until date, then locked", () => {
    expect(licenceState(lic(), st({ status: "suspended" }), DAY).level).toBe("readonly");
    expect(licenceState(lic(), st({ status: "revoked", readOnlyUntil: 10 * DAY }), DAY).level).toBe("readonly");
    expect(licenceState(lic(), st({ status: "revoked", readOnlyUntil: 10 * DAY }), 11 * DAY).level).toBe("locked");
  });
  it("ignores a status meant for another lab", () => {
    expect(licenceState(lic(), st({ labId: "other", status: "revoked" }), DAY).level).toBe("ok");
  });
});

import { readFileSync } from "node:fs";
describe("shared code", () => {
  it("lab app and Control Centre use the same licence code", () => {
    expect(readFileSync("control-centre/src/lib/licence.ts", "utf8")).toBe(readFileSync("shared/licence.ts", "utf8"));
  });
});
