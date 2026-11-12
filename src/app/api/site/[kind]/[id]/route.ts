import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { kindOf } from "@/lib/server/siteItems";

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function load(kind: string, id: string) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, "Invalid id");
  const k = kindOf(kind);
  const ref = db().doc(`${k.source}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Not found");
  return { k, ref, data: snap.data() as Record<string, unknown> };
}

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { kind, id } = await params;
  const { k, ref, data } = await load(kind, id);
  const input = (await parseBody(req, k.schema)) as Record<string, unknown>;
  const item = { ...data, ...input };
  const b = db().batch();
  b.set(ref, item);
  if ((k.isPublic as (d: unknown) => boolean)(item)) b.set(db().doc(`${k.mirror}/${id}`), item);
  else b.delete(db().doc(`${k.mirror}/${id}`));
  audit(b, ctx, `site.${kind}.updated`, kind, id, data, input);
  await b.commit();
  return ok();
});

export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { kind, id } = await params;
  const { k, ref, data } = await load(kind, id);
  const b = db().batch();
  b.delete(ref);
  b.delete(db().doc(`${k.mirror}/${id}`));
  audit(b, ctx, `site.${kind}.deleted`, kind, id, data, null);
  await b.commit();
  return ok();
});
