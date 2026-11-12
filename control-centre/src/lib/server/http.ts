import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_BODY_BYTES = 100 * 1024;

export async function parseBody<T extends z.ZodType>(req: NextRequest, schema: T, maxBytes = MAX_BODY_BYTES): Promise<z.infer<T>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("application/json")) throw new HttpError(415, "Expected JSON");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Malformed JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input");
  }
  return parsed.data;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse | Response>;

/** Wrap a route handler: uniform JSON errors, no internal details leaked. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}

export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status });
