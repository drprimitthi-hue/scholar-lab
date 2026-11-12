import { db } from "@/lib/server/admin";
import { HttpError, ok, route } from "@/lib/server/http";
import { generateKeys } from "@/lib/licence";

/** Before first setup only: generate a licence key pair to paste into the environment variables. */
export const POST = route(async () => {
  if (process.env.LICENCE_PRIVATE_KEY) throw new HttpError(409, "Keys are already configured");
  if ((await db().doc("system/setup").get()).exists) throw new HttpError(409, "Already set up");
  return ok(generateKeys());
});
