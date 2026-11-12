/**
 * Multi-repo support. project_repos is the source of truth; projects.repo_path mirrors the first repo's path.
 * Relative imports only (used by the MCP server).
 */
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { projectRepos, projects, testPlans } from "../db/schema";
import { getGitInfo, type GitInfo } from "./git";

export type RepoDTO = { id: number; label: string; path: string };
export type RepoGitInfo = GitInfo & { label: string; path: string };

export const repoInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9][\w .-]*$/, "label may contain letters, numbers, space, _ . - and must start alphanumeric"),
  path: z
    .string()
    .trim()
    .min(1)
    .refine((v) => path.isAbsolute(v), { message: "path must be an absolute path" }),
});
export type RepoInput = z.input<typeof repoInputSchema>;

type Db = Pick<typeof db, "select" | "insert" | "update" | "delete">;

const toDTO = (r: { id: number; label: string; path: string }): RepoDTO => ({
  id: r.id,
  label: r.label,
  path: r.path,
});

/** Repos of a project ordered by id. Lazily backfills projects.repo_path as repo "main". */
export async function listRepos(projectId: number, conn: Db = db): Promise<RepoDTO[]> {
  const rows = await conn
    .select()
    .from(projectRepos)
    .where(eq(projectRepos.projectId, projectId))
    .orderBy(asc(projectRepos.id));
  if (rows.length) return rows.map(toDTO);

  const [project] = await conn
    .select({ repoPath: projects.repoPath })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project?.repoPath) return [];
  await conn
    .insert(projectRepos)
    .values({ projectId, label: "main", path: project.repoPath })
    .onConflictDoNothing();
  const again = await conn
    .select()
    .from(projectRepos)
    .where(eq(projectRepos.projectId, projectId))
    .orderBy(asc(projectRepos.id));
  return again.map(toDTO);
}

/** Replace the whole repo list (diff by label, keeping ids of unchanged labels). */
export async function replaceRepos(
  projectId: number,
  input: RepoInput[],
  outerTx?: Pick<typeof db, "select" | "insert" | "update" | "delete">,
): Promise<RepoDTO[]> {
  // Lazy import: plans.ts imports this module at load time (avoids a circular-init crash).
  const { BadRequestError } = await import("./plans");
  const repos = z.array(repoInputSchema).parse(input);
  const seen = new Set<string>();
  for (const r of repos) {
    const key = r.label.toLowerCase();
    if (seen.has(key)) throw new BadRequestError(`Duplicate repo label "${r.label}"`);
    seen.add(key);
  }

  const run = async (tx: Pick<typeof db, "select" | "insert" | "update" | "delete">) => {
    // Materialise any legacy repo_path first so the diff sees the real current state.
    const existing = await listRepos(projectId, tx);
    const byLabel = new Map(existing.map((r) => [r.label, r]));
    const wanted = new Set(repos.map((r) => r.label));

    const removed = existing.filter((e) => !wanted.has(e.label)).map((e) => e.label);
    for (const e of existing) {
      if (!wanted.has(e.label)) await tx.delete(projectRepos).where(eq(projectRepos.id, e.id));
    }
    if (removed.length) {
      // Prune labels of removed/renamed repos from plans so their repo chips don't go stale.
      const plans = await tx
        .select({ id: testPlans.id, repoLabels: testPlans.repoLabels })
        .from(testPlans)
        .where(eq(testPlans.projectId, projectId));
      for (const pl of plans) {
        const kept = (pl.repoLabels ?? []).filter((l) => !removed.includes(l));
        if (kept.length !== (pl.repoLabels ?? []).length)
          await tx.update(testPlans).set({ repoLabels: kept }).where(eq(testPlans.id, pl.id));
      }
    }
    for (const r of repos) {
      const cur = byLabel.get(r.label);
      if (!cur) await tx.insert(projectRepos).values({ projectId, label: r.label, path: r.path });
      else if (cur.path !== r.path)
        await tx.update(projectRepos).set({ path: r.path }).where(eq(projectRepos.id, cur.id));
    }

    const finalRows = await tx
      .select()
      .from(projectRepos)
      .where(eq(projectRepos.projectId, projectId))
      .orderBy(asc(projectRepos.id));
    await tx
      .update(projects)
      .set({ repoPath: finalRows[0]?.path ?? null })
      .where(eq(projects.id, projectId));
    return finalRows.map(toDTO);
  };
  return outerTx ? run(outerTx) : db.transaction((tx) => run(tx));
}

/** Git info for every repo of a project. Zero repos => {repos: []}. */
export async function getProjectGit(projectId: number): Promise<{ repos: RepoGitInfo[] }> {
  const repos = await listRepos(projectId);
  const infos = await Promise.all(
    repos.map(async (r): Promise<RepoGitInfo> => ({ ...(await getGitInfo(r.path)), label: r.label, path: r.path })),
  );
  return { repos: infos };
}
