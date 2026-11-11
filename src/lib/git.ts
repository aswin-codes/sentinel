import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const run = promisify(execFile);

export type GitInfo = {
  ok: boolean;
  error?: string;
  branch?: string;
  commitHash?: string;
  status?: string;
  diffStat?: string;
  recentCommits?: string;
};

async function git(repoPath: string, args: string[], maxBuffer = 2 * 1024 * 1024) {
  // execFile (no shell) so repoPath / args can't inject commands.
  const { stdout } = await run("git", ["-C", repoPath, ...args], {
    maxBuffer,
    timeout: 15_000,
    windowsHide: true,
  });
  return stdout.trimEnd();
}

function validateRepo(repoPath: string | null | undefined): string | null {
  if (!repoPath) return "Project has no repoPath set.";
  if (!path.isAbsolute(repoPath)) return "repoPath must be an absolute path.";
  if (!existsSync(repoPath) || !statSync(repoPath).isDirectory())
    return `repoPath does not exist: ${repoPath}`;
  return null;
}

/** Branch, short status, diff --stat and recent commits. Never throws. */
export async function getGitInfo(repoPath: string | null | undefined): Promise<GitInfo> {
  const invalid = validateRepo(repoPath);
  if (invalid) return { ok: false, error: invalid };
  const p = repoPath!;
  try {
    const [branch, commitHash, status, diffStat, recentCommits] = await Promise.all([
      git(p, ["rev-parse", "--abbrev-ref", "HEAD"]),
      git(p, ["rev-parse", "--short", "HEAD"]).catch(() => ""),
      git(p, ["status", "--short", "--branch"]),
      git(p, ["diff", "HEAD", "--stat"]).catch(() => ""),
      git(p, ["log", "--oneline", "-n", "10"]).catch(() => ""),
    ]);
    return { ok: true, branch, commitHash, status, diffStat, recentCommits };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Full diff for agents. `base` (e.g. "main") diffs base...HEAD plus working tree;
 * otherwise diffs working tree against HEAD. Output truncated to maxChars.
 */
export async function getGitDiff(
  repoPath: string | null | undefined,
  opts: { base?: string; maxChars?: number } = {},
): Promise<{ ok: boolean; error?: string; diff?: string; truncated?: boolean }> {
  const invalid = validateRepo(repoPath);
  if (invalid) return { ok: false, error: invalid };
  const maxChars = opts.maxChars ?? 60_000;
  if (opts.base && !/^[\w./-]+$/.test(opts.base)) return { ok: false, error: "Invalid base ref." };
  try {
    const args = opts.base ? ["diff", opts.base] : ["diff", "HEAD"];
    const diff = await git(repoPath!, args, 32 * 1024 * 1024);
    const truncated = diff.length > maxChars;
    return { ok: true, diff: truncated ? diff.slice(0, maxChars) : diff, truncated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
