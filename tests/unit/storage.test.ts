import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloudinarySignature } from "@/lib/server/cloudinarySign";

vi.mock("@/lib/server/admin", () => ({ bucket: () => { throw new Error("firebase not used in these tests"); } }));

type Call = { url: string; method: string; headers: Record<string, string>; form?: Record<string, string> };
let calls: Call[] = [];
let respond: (c: Call) => Response;

beforeEach(() => {
  process.env.FILE_STORAGE = "cloudinary";
  process.env.CLOUDINARY_CLOUD_NAME = "labcloud";
  process.env.CLOUDINARY_API_KEY = "111";
  process.env.CLOUDINARY_API_SECRET = "topsecret";
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {}));
    let form: Record<string, string> | undefined;
    if (init?.body instanceof FormData) { form = {}; for (const [k, v] of init.body.entries()) form[k] = typeof v === "string" ? v : `<file ${(v as Blob).size}>`; }
    const c = { url: String(url), method: init?.method ?? "GET", headers, form };
    calls.push(c);
    return respond(c);
  }));
});
afterEach(() => vi.unstubAllGlobals());

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

describe("Cloudinary storage (simulated)", async () => {
  const s = await import("@/lib/server/storage");
  const basic = `Basic ${Buffer.from("111:topsecret").toString("base64")}`;

  it("fileInfo asks the Admin API for the private raw file; 404 means missing", async () => {
    respond = () => json({ bytes: 1234, public_id: "scholars/U/uploads/a.pdf" });
    expect(await s.fileInfo("scholars/U/uploads/a.pdf")).toEqual({ size: 1234, contentType: "application/pdf" });
    expect(calls[0]!.url).toBe("https://api.cloudinary.com/v1_1/labcloud/resources/raw/authenticated/scholars/U/uploads/a.pdf");
    expect(calls[0]!.headers.Authorization).toBe(basic);
    respond = () => json({ error: { message: "not found" } }, 404);
    expect(await s.fileInfo("x/y.pdf")).toBeNull();
  });

  it("upload tickets are signed for one exact private path and never contain the secret", () => {
    const t = s.uploadTicket("office/S/1-a.pdf", "application/pdf") as { provider: string; url: string; fields: Record<string, string> };
    expect(t.provider).toBe("cloudinary");
    expect(t.url).toBe("https://api.cloudinary.com/v1_1/labcloud/raw/upload");
    expect(t.fields).toMatchObject({ public_id: "office/S/1-a.pdf", type: "authenticated", overwrite: "false", api_key: "111" });
    expect(t.fields.signature).toBe(cloudinarySignature({ public_id: "office/S/1-a.pdf", timestamp: t.fields.timestamp!, type: "authenticated", overwrite: "false" }, "topsecret"));
    expect(JSON.stringify(t)).not.toContain("topsecret");
  });

  it("saveBytes posts a signed private upload with the file", async () => {
    respond = () => json({ public_id: "office/S/bundles/b.pdf" });
    await s.saveBytes("office/S/bundles/b.pdf", new Uint8Array([1, 2, 3]), "application/pdf");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.form).toMatchObject({ public_id: "office/S/bundles/b.pdf", type: "authenticated", api_key: "111", file: "<file 3>" });
    expect(calls[0]!.form!.signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it("readBytes downloads through an expiring signed link", async () => {
    respond = () => new Response(new Uint8Array([9, 8, 7]));
    expect([...(await s.readBytes("scholars/U/uploads/a.pdf"))]).toEqual([9, 8, 7]);
    const u = new URL(calls[0]!.url);
    expect(u.pathname).toBe("/v1_1/labcloud/raw/download");
    expect(Number(u.searchParams.get("expires_at")) - Number(u.searchParams.get("timestamp"))).toBe(120);
  });

  it("delete by prefix, list with cursor, delete specific files", async () => {
    respond = (c) => c.method === "GET" ? json({ resources: [{ public_id: "office/S/bundles/x.pdf", bytes: 5, created_at: "2026-01-01T00:00:00Z" }], next_cursor: "N2" }) : json({ deleted: {} });
    await s.deletePrefix("scholars/U/");
    expect(calls[0]!).toMatchObject({ method: "DELETE", url: "https://api.cloudinary.com/v1_1/labcloud/resources/raw/authenticated?prefix=scholars%2FU%2F" });
    const page = await s.listPrefix("office/", "N1");
    expect(page).toEqual({ files: [{ path: "office/S/bundles/x.pdf", size: 5, created: Date.parse("2026-01-01T00:00:00Z") }], next: "N2" });
    expect(calls[1]!.url).toContain("next_cursor=N1");
    await s.deleteFiles(["a.pdf", "b.pdf"]);
    expect(calls[2]!.url).toContain("public_ids%5B%5D=a.pdf&public_ids%5B%5D=b.pdf");
  });

  it("self-test reports success and a clear failure", async () => {
    let stored: Uint8Array | null = null;
    respond = (c) => {
      if (c.url.endsWith("/raw/upload")) { stored = new Uint8Array(21); return json({}); }
      if (c.url.includes("/resources/raw/authenticated/")) return json({ bytes: 21 });
      if (c.url.includes("/raw/download")) return new Response(stored ?? new Uint8Array(0));
      return json({});
    };
    expect((await s.selfTest()).ok).toBe(true);
    respond = () => json({ error: { message: "Invalid Signature" } }, 401);
    const bad = await s.selfTest();
    expect(bad.ok).toBe(false);
    expect(bad.detail).toContain("Cloudinary");
  });

  it("refuses to run without its settings or with an unknown provider", async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => s.uploadTicket("a.pdf", "application/pdf")).toThrow(/not configured/);
    process.env.FILE_STORAGE = "dropbox";
    expect(() => s.provider()).toThrow(/cloudinary' or 'firebase/);
    process.env.FILE_STORAGE = "";
    expect(s.provider()).toBe("firebase");
  });
});
