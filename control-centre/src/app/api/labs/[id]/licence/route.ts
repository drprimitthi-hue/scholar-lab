import type { NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { licenceSchema } from "@/lib/schemas";
import { signObject, type LicencePayload } from "@/lib/licence";
import { loadLab } from "@/lib/server/labs";

type Ctx = { params: Promise<{ id: string }> };

/** Issue or renew a licence. The lab picks up a renewal automatically at its next daily check-in. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const me = await guard(req, 15 * 60);
  const { id } = await params;
  const input = await parseBody(req, licenceSchema);
  const key = process.env.LICENCE_PRIVATE_KEY;
  if (!key) throw new HttpError(500, "Licence keys are not configured");
  const { ref, lab } = await loadLab(id);
  const exp = input.expiresOn ? Date.parse(`${input.expiresOn}T23:59:59+05:30`) : null;
  if (exp !== null && exp < Date.now()) throw new HttpError(400, "Expiry date is in the past");
  const payload: LicencePayload = { v: 1, labId: id, labName: lab.labName, domains: lab.domains, iat: Date.now(), exp, grace: input.graceDays };
  const token = signObject(payload, key);
  await ref.update({ licence: { token, iat: payload.iat, exp, grace: input.graceDays }, updatedAt: Date.now() });
  await audit(lab.licence ? "licence.renewed" : "licence.issued", id, me.email, { expiresOn: input.expiresOn || "never", graceDays: input.graceDays });
  return ok({ token });
});
