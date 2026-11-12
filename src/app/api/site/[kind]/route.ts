import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { kindOf } from "@/lib/server/siteItems";

type Ctx = { params: Promise<{ kind: string }> };

export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { kind } = await params;
  const k = kindOf(kind);
  const input = (await parseBody(req, k.schema)) as Record<string, unknown>;
  const ref = db().collection(k.source).doc();
  const item = { ...input, id: ref.id, createdAt: Date.now(), ...(kind === "news" ? { auto: false } : {}) };
  const b = db().batch();
  b.set(ref, item);
  if ((k.isPublic as (d: unknown) => boolean)(item)) b.set(db().doc(`${k.mirror}/${ref.id}`), item);
  audit(b, ctx, `site.${kind}.created`, kind, ref.id, null, { title: input.title });
  await b.commit();
  return ok({ id: ref.id }, 201);
});
