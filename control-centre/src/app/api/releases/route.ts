import type { NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, route } from "@/lib/server/http";

// "main" = latest code (your own lab follows it). "stable" = what all other labs run.
// Releasing fast-forwards stable to main; Vercel then rebuilds every lab that follows stable.
async function gh(path: string, init?: RequestInit) {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new HttpError(503, "GitHub is not configured (GITHUB_TOKEN, GITHUB_REPO)");
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: json as Record<string, unknown> };
}

/** The CI workflow result for a commit: only a version whose checks passed may be released to other labs. */
async function ciStatus(sha: string): Promise<"passed" | "failed" | "running" | "none" | "unknown"> {
  const r = await gh(`/actions/runs?head_sha=${sha}&per_page=20`);
  if (!r.ok) return "unknown";
  const runs = ((r.json.workflow_runs as { name: string; status: string; conclusion: string | null }[]) ?? []).filter((x) => x.name === "CI");
  if (!runs.length) return "none";
  if (runs.some((x) => x.status !== "completed")) return "running";
  return runs.every((x) => x.conclusion === "success") ? "passed" : "failed";
}

export const GET = route(async (req: NextRequest) => {
  await guard(req);
  const main = await gh("/git/ref/heads/main");
  if (!main.ok) throw new HttpError(502, "Could not read the main branch");
  const mainSha = (main.json.object as { sha: string }).sha;
  const stable = await gh("/git/ref/heads/stable");
  if (!stable.ok) return ok({ mainSha, stableSha: null, ahead: null, commits: [] });
  const stableSha = (stable.json.object as { sha: string }).sha;
  const cmp = await gh(`/compare/${stableSha}...${mainSha}`);
  const commits = ((cmp.json.commits as { sha: string; commit: { message: string; author: { date: string } } }[]) ?? [])
    .map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split("\n")[0], date: c.commit.author.date }));
  return ok({ mainSha, stableSha, ahead: cmp.json.ahead_by ?? null, behind: cmp.json.behind_by ?? null, commits, ci: await ciStatus(mainSha) });
});

export const POST = route(async (req: NextRequest) => {
  const me = await guard(req, 15 * 60);
  const main = await gh("/git/ref/heads/main");
  if (!main.ok) throw new HttpError(502, "Could not read the main branch");
  const sha = (main.json.object as { sha: string }).sha;
  const ci = await ciStatus(sha);
  if (ci !== "passed") throw new HttpError(409, {
    failed: "The automatic checks (CI) failed for this version. Fix it on main first; nothing was released.",
    running: "The automatic checks (CI) are still running for this version. Try again in a few minutes.",
    none: "No CI result was found for this version yet. Wait a few minutes after the push and try again.",
    unknown: "Could not read the CI result. Give the GitHub token “Actions: Read-only” permission and try again.",
  }[ci]);
  const existing = await gh("/git/ref/heads/stable");
  const r = existing.ok
    ? await gh("/git/refs/heads/stable", { method: "PATCH", body: JSON.stringify({ sha, force: false }) })
    : await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/stable", sha }) });
  if (!r.ok) throw new HttpError(502, `GitHub refused the update: ${String((r.json as { message?: string }).message ?? r.status)}`);
  await audit("release.published", "releases", me.email, { sha: sha.slice(0, 7), ci });
  return ok({ sha: sha.slice(0, 7) });
});
