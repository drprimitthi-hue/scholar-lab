import type { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";

export const GET = route(async (req: NextRequest) => {
  const me = await guard(req);
  return ok({
    email: me.email,
    publicKey: process.env.LICENCE_PUBLIC_KEY ?? "",
    controlCentreUrl: process.env.CONTROL_CENTRE_URL ?? "",
    keysConfigured: Boolean(process.env.LICENCE_PRIVATE_KEY && process.env.LICENCE_PUBLIC_KEY),
    githubConfigured: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
  });
});
