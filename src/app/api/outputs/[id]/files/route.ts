import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertOutputEditor, checkFiles, indexFiles, loadOutput } from "@/lib/server/outputs";
import { outputFileSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Attach a file (manuscript, acceptance letter, filing receipt, certificate). Files are append-only. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "scholar"] });
  const { id } = await params;
  const { file } = await parseBody(req, outputFileSchema);
  const { ref, data } = await loadOutput(id);
  assertOutputEditor(ctx, data);
  if (data.files.length >= 40) throw new HttpError(400, "Too many files on this output");
  const [f] = await checkFiles(ctx, [file]);
  const b = db().batch();
  b.update(ref, { files: [...data.files, f!], filePaths: [...data.filePaths, f!.path], updatedAt: Date.now() });
  indexFiles(b, [f!], { type: "output", id });
  audit(b, ctx, "output.file_added", "output", id, null, { name: f!.name });
  await b.commit();
  return ok();
});
