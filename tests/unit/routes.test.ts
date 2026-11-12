// Static safety net: every API route must authenticate and validate. Fails the build if a new route forgets.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "../../src/app/api");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : f === "route.ts" ? [p] : []; });
const routes = walk(ROOT).map((p) => ({ path: relative(ROOT, p), src: readFileSync(p, "utf8") }));

/** Routes that authenticate with a secret instead of a signed-in user (each checked below). */
const SECRET_AUTH: Record<string, RegExp> = {
  "cron/purge/route.ts": /timingSafeEqual[\s\S]*CRON_SECRET|CRON_SECRET[\s\S]*timingSafeEqual/,
  "cron/heartbeat/route.ts": /CRON_SECRET[\s\S]*timingSafeEqual/,
  "setup/route.ts": /SETUP_TOKEN[\s\S]*timingSafeEqual/,
};
/** Write routes that take no request body by design. */
const NO_BODY = new Set(["me/password-changed/route.ts", "system/heartbeat/route.ts", "system/sync/route.ts", "site/resync/route.ts", "scholars/[uid]/milestones/generate/route.ts", "cron/purge/route.ts", "cron/heartbeat/route.ts"]);

describe("API routes", () => {
  it("found the routes", () => expect(routes.length).toBeGreaterThan(50));
  for (const r of routes) {
    describe(r.path, () => {
      const handlers = [...r.src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      it("exports only wrapped handlers", () => {
        expect(handlers.length).toBeGreaterThan(0);
        expect(r.src).not.toMatch(/export (async )?function (GET|POST|PUT|PATCH|DELETE)/);
        for (const h of handlers) expect(r.src).toMatch(new RegExp(`export const ${h} = route`));
      });
      it("authenticates every handler", () => {
        if (SECRET_AUTH[r.path]) { expect(r.src).toMatch(SECRET_AUTH[r.path]!); return; }
        const guards = (r.src.match(/await guard\(/g) ?? []).length;
        expect(guards).toBeGreaterThanOrEqual(handlers.length);
      });
      it("validates request bodies with a schema", () => {
        if (!handlers.some((h) => h !== "GET" && h !== "DELETE") || NO_BODY.has(r.path)) return;
        expect(r.src).toMatch(/parseBody\(/);
        expect(r.src).not.toMatch(/req(uest)?\.json\(\)/);
      });
    });
  }
});

describe("client code", () => {
  const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|ts)$/.test(f) ? [p] : []; });
  const all = files(join(__dirname, "../../src"));
  it("never injects raw HTML or evaluates strings", () => {
    for (const f of all) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/\beval\(|new Function\(|\.innerHTML\s*=/);
      if (/dangerouslySetInnerHTML/.test(s)) expect(relative(join(__dirname, "../../src"), f), "only the JSON-LD script may use it").toMatch(/^app\/\(public\)\//);
    }
  });
  it("never writes Firestore from the browser", () => {
    for (const f of all.filter((x) => /src\/(app|components|lib\/client)\//.test(x) && !/\/api\//.test(x))) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\b/);
    }
  });
});
