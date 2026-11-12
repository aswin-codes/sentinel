/**
 * Shared plan service — used by API route handlers AND the MCP server.
 * Keep imports relative (no "@/") so tsx can run mcp-server without path aliases.
 */
import path from "node:path";
import { and, asc, count, desc, eq, inArray, max, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  projectRepos,
  projects,
  testCases,
  testPlans,
  testResults,
  testRuns,
  testSections,
  type ResultStatus,
  type Tag,
} from "../db/schema";
import { listRepos, replaceRepos, repoInputSchema, type RepoDTO } from "./repos";

// ---------- Validation schemas ----------

export const tagSchema = z.object({
  label: z.string().min(1).max(40),
  color: z.string().min(1).max(32).default("zinc"),
});

export const caseInputSchema = z.object({
  code: z.string().min(1).max(16).describe("Short case code, e.g. 'S1', 'A2'"),
  title: z.string().min(1).max(300),
  steps: z.array(z.string()).default([]),
  expected: z.array(z.string()).default([]),
  tags: z.array(tagSchema).default([]),
  agentPrompt: z.string().nullish(),
});

export const sectionInputSchema = z.object({
  code: z.string().min(1).max(8).describe("Section letter/code, e.g. 'S', 'A'"),
  title: z.string().min(1).max(200),
  description: z.string().nullish(),
  cases: z.array(caseInputSchema).default([]),
});

export const planInputSchema = z.object({
  projectId: z.number().int().positive(),
  planId: z.number().int().positive().optional().describe("Update this plan id explicitly"),
  planTitle: z.string().min(1).max(200),
  description: z.string().nullish(),
  gitBranch: z.string().nullish(),
  commitHash: z.string().nullish(),
  repoLabels: z.array(z.string()).optional().describe("Labels of the project repos this plan covers (optional)"),
  status: z.enum(["draft", "active", "archived"]).optional(),
  sections: z.array(sectionInputSchema).default([]),
  mode: z
    .enum(["replace", "merge"])
    .default("replace")
    .describe("replace: remove sections/cases not in input. merge: keep them."),
});

export type PlanInput = z.input<typeof planInputSchema>;

// ---------- Types returned to clients ----------

export type CaseWithResult = {
  id: number;
  sectionId: number;
  code: string;
  title: string;
  steps: string[];
  expected: string[];
  tags: Tag[];
  agentPrompt: string | null;
  orderIndex: number;
  result: { status: ResultStatus; notes: string | null; updatedAt: string | null };
};

export type SectionFull = {
  id: number;
  planId: number;
  code: string;
  title: string;
  description: string | null;
  orderIndex: number;
  cases: CaseWithResult[];
};

export type RunSummary = { id: number; planId: number; name: string; createdAt: string };

export type PlanFull = {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description: string | null;
  gitBranch: string | null;
  commitHash: string | null;
  repoLabels: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  sections: SectionFull[];
  runs: RunSummary[];
  activeRunId: number | null;
  counts: { total: number; pass: number; fail: number; notRun: number };
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

// ---------- Queries ----------

export async function ensureRun(planId: number): Promise<number> {
  const [latest] = await db
    .select({ id: testRuns.id })
    .from(testRuns)
    .where(eq(testRuns.planId, planId))
    .orderBy(desc(testRuns.createdAt), desc(testRuns.id))
    .limit(1);
  if (latest) return latest.id;
  const [created] = await db
    .insert(testRuns)
    .values({ planId, name: "Run 1" })
    .returning({ id: testRuns.id });
  return created.id;
}

/** Full nested plan with results for `runId` (defaults to the latest run). */
export async function getPlanFull(planId: number, runId?: number): Promise<PlanFull | null> {
  const [plan] = await db
    .select({ plan: testPlans, projectName: projects.name })
    .from(testPlans)
    .innerJoin(projects, eq(projects.id, testPlans.projectId))
    .where(eq(testPlans.id, planId));
  if (!plan) return null;

  const runs = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.planId, planId))
    .orderBy(desc(testRuns.createdAt), desc(testRuns.id));

  const activeRunId =
    runId && runs.some((r) => r.id === runId) ? runId : (runs[0]?.id ?? null);

  const sections = await db
    .select()
    .from(testSections)
    .where(eq(testSections.planId, planId))
    .orderBy(asc(testSections.orderIndex), asc(testSections.id));

  const sectionIds = sections.map((s) => s.id);
  const cases = sectionIds.length
    ? await db
        .select()
        .from(testCases)
        .where(inArray(testCases.sectionId, sectionIds))
        .orderBy(asc(testCases.orderIndex), asc(testCases.id))
    : [];

  const results = activeRunId
    ? await db.select().from(testResults).where(eq(testResults.runId, activeRunId))
    : [];
  const resultByCase = new Map(results.map((r) => [r.caseId, r]));

  const counts = { total: 0, pass: 0, fail: 0, notRun: 0 };
  const sectionsFull: SectionFull[] = sections.map((s) => ({
    id: s.id,
    planId: s.planId,
    code: s.code,
    title: s.title,
    description: s.description,
    orderIndex: s.orderIndex,
    cases: cases
      .filter((c) => c.sectionId === s.id)
      .map((c) => {
        const r = resultByCase.get(c.id);
        const status: ResultStatus = r?.status ?? "not_run";
        counts.total++;
        if (status === "pass") counts.pass++;
        else if (status === "fail") counts.fail++;
        else counts.notRun++;
        return {
          id: c.id,
          sectionId: c.sectionId,
          code: c.code,
          title: c.title,
          steps: c.steps ?? [],
          expected: c.expected ?? [],
          tags: c.tags ?? [],
          agentPrompt: c.agentPrompt,
          orderIndex: c.orderIndex,
          result: { status, notes: r?.notes ?? null, updatedAt: iso(r?.updatedAt) },
        };
      }),
  }));

  const p = plan.plan;
  return {
    id: p.id,
    projectId: p.projectId,
    projectName: plan.projectName,
    title: p.title,
    description: p.description,
    gitBranch: p.gitBranch,
    commitHash: p.commitHash,
    repoLabels: p.repoLabels ?? [],
    status: p.status,
    createdAt: iso(p.createdAt)!,
    updatedAt: iso(p.updatedAt)!,
    sections: sectionsFull,
    runs: runs.map((r) => ({ id: r.id, planId: r.planId, name: r.name, createdAt: iso(r.createdAt)! })),
    activeRunId,
    counts,
  };
}

/** Reject plan repo labels that aren't repos of the project. */
async function assertKnownRepoLabels(projectId: number, labels: string[], conn?: Parameters<typeof listRepos>[1]) {
  const known = new Set((await listRepos(projectId, conn)).map((r) => r.label));
  const unknown = [...new Set(labels)].filter((l) => !known.has(l));
  if (unknown.length)
    throw new BadRequestError(
      `Unknown repo label(s): ${unknown.join(", ")}. Project repos: ${[...known].join(", ") || "(none)"}`,
    );
}

/**
 * Create or update a plan by (projectId, title) or explicit planId.
 * Sections are matched by code within the plan, cases by code within the section,
 * so existing ids — and therefore existing Pass/Fail results — are preserved.
 */
export async function upsertPlan(raw: PlanInput): Promise<{ planId: number; created: boolean }> {
  const input = planInputSchema.parse(raw);

  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId));
    if (!project) throw new NotFoundError(`Project ${input.projectId} not found`);

    let existing = input.planId
      ? (await tx.select().from(testPlans).where(eq(testPlans.id, input.planId)))[0]
      : (
          await tx
            .select()
            .from(testPlans)
            .where(and(eq(testPlans.projectId, input.projectId), eq(testPlans.title, input.planTitle)))
        )[0];
    if (existing && existing.projectId !== input.projectId)
      throw new BadRequestError(`Plan ${existing.id} belongs to a different project`);

    if (input.repoLabels !== undefined) await assertKnownRepoLabels(input.projectId, input.repoLabels, tx);

    const fields = {
      title: input.planTitle,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.gitBranch !== undefined && { gitBranch: input.gitBranch }),
      ...(input.commitHash !== undefined && { commitHash: input.commitHash }),
      ...(input.repoLabels !== undefined && { repoLabels: input.repoLabels }),
      ...(input.status && { status: input.status }),
    };

    let planId: number;
    let created = false;
    if (existing) {
      planId = existing.id;
      await tx.update(testPlans).set({ ...fields, updatedAt: new Date() }).where(eq(testPlans.id, planId));
    } else {
      [existing] = await tx
        .insert(testPlans)
        .values({ projectId: input.projectId, ...fields })
        .returning();
      planId = existing.id;
      created = true;
    }

    const keptSectionIds: number[] = [];
    for (const [si, s] of input.sections.entries()) {
      const [sec] = await tx
        .insert(testSections)
        .values({ planId, code: s.code, title: s.title, description: s.description ?? null, orderIndex: si })
        .onConflictDoUpdate({
          target: [testSections.planId, testSections.code],
          set: { title: s.title, description: s.description ?? null, orderIndex: si },
        })
        .returning({ id: testSections.id });
      keptSectionIds.push(sec.id);

      const keptCaseIds: number[] = [];
      for (const [ci, c] of s.cases.entries()) {
        const values = {
          title: c.title,
          steps: c.steps,
          expected: c.expected,
          tags: c.tags,
          agentPrompt: c.agentPrompt ?? null,
          orderIndex: ci,
        };
        const [row] = await tx
          .insert(testCases)
          .values({ sectionId: sec.id, code: c.code, ...values })
          .onConflictDoUpdate({ target: [testCases.sectionId, testCases.code], set: values })
          .returning({ id: testCases.id });
        keptCaseIds.push(row.id);
      }
      if (input.mode === "replace") {
        await tx
          .delete(testCases)
          .where(
            keptCaseIds.length
              ? and(eq(testCases.sectionId, sec.id), notInArray(testCases.id, keptCaseIds))
              : eq(testCases.sectionId, sec.id),
          );
      }
    }
    if (input.mode === "replace") {
      await tx
        .delete(testSections)
        .where(
          keptSectionIds.length
            ? and(eq(testSections.planId, planId), notInArray(testSections.id, keptSectionIds))
            : eq(testSections.planId, planId),
        );
    }

    const [run] = await tx.select({ id: testRuns.id }).from(testRuns).where(eq(testRuns.planId, planId)).limit(1);
    if (!run) await tx.insert(testRuns).values({ planId, name: "Run 1" });

    return { planId, created };
  });
}

/** Upsert one result (pass/fail/not_run + notes) for run+case. */
export async function setResult(args: {
  runId: number;
  caseId: number;
  status?: ResultStatus;
  notes?: string | null;
}) {
  const now = new Date();
  const set: Partial<typeof testResults.$inferInsert> = { updatedAt: now };
  if (args.status !== undefined) set.status = args.status;
  if (args.notes !== undefined) set.notes = args.notes;
  const [row] = await db
    .insert(testResults)
    .values({
      runId: args.runId,
      caseId: args.caseId,
      status: args.status ?? "not_run",
      notes: args.notes ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: [testResults.runId, testResults.caseId], set })
    .returning();
  return row;
}

/** Failed cases (with notes) for a plan's run (default: latest). */
export async function getFailedCases(planId: number, runId?: number) {
  const plan = await getPlanFull(planId, runId);
  if (!plan) return null;
  const failed = plan.sections.flatMap((s) =>
    s.cases
      .filter((c) => c.result.status === "fail")
      .map((c) => ({
        caseId: c.id,
        code: c.code,
        section: `${s.code} · ${s.title}`,
        title: c.title,
        steps: c.steps,
        expected: c.expected,
        notes: c.result.notes,
        agentPrompt: c.agentPrompt,
        markedAt: c.result.updatedAt,
      })),
  );
  return {
    planId: plan.id,
    planTitle: plan.title,
    projectName: plan.projectName,
    runId: plan.activeRunId,
    runName: plan.runs.find((r) => r.id === plan.activeRunId)?.name ?? null,
    counts: plan.counts,
    failed,
  };
}

export class NotFoundError extends Error {}

// ---------- Extra helpers for REST routes ----------

export type PlanListItem = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  gitBranch: string | null;
  commitHash: string | null;
  repoLabels: string[];
  status: string;
  updatedAt: string;
  latestRunId: number | null;
  counts: { total: number; pass: number; fail: number; notRun: number };
};

/** Plans for a project (updatedAt desc) with counts for each plan's latest run. */
export async function listPlans(projectId: number): Promise<PlanListItem[]> {
  const plans = await db
    .select()
    .from(testPlans)
    .where(eq(testPlans.projectId, projectId))
    .orderBy(desc(testPlans.updatedAt), desc(testPlans.id));
  if (!plans.length) return [];
  const planIds = plans.map((p) => p.id);

  const runs = await db
    .select({ id: testRuns.id, planId: testRuns.planId })
    .from(testRuns)
    .where(inArray(testRuns.planId, planIds))
    .orderBy(desc(testRuns.createdAt), desc(testRuns.id));
  const latestRun = new Map<number, number>();
  for (const r of runs) if (!latestRun.has(r.planId)) latestRun.set(r.planId, r.id);

  const caseRows = await db
    .select({ planId: testSections.planId, caseId: testCases.id })
    .from(testCases)
    .innerJoin(testSections, eq(testSections.id, testCases.sectionId))
    .where(inArray(testSections.planId, planIds));
  const casesByPlan = new Map<number, Set<number>>();
  for (const c of caseRows) {
    if (!casesByPlan.has(c.planId)) casesByPlan.set(c.planId, new Set());
    casesByPlan.get(c.planId)!.add(c.caseId);
  }

  const runIds = [...latestRun.values()];
  const results = runIds.length
    ? await db
        .select({ runId: testResults.runId, caseId: testResults.caseId, status: testResults.status })
        .from(testResults)
        .where(inArray(testResults.runId, runIds))
    : [];
  const resultsByRun = new Map<number, typeof results>();
  for (const r of results) {
    if (!resultsByRun.has(r.runId)) resultsByRun.set(r.runId, []);
    resultsByRun.get(r.runId)!.push(r);
  }

  return plans.map((p) => {
    const runId = latestRun.get(p.id) ?? null;
    const caseIds = casesByPlan.get(p.id) ?? new Set<number>();
    let pass = 0;
    let fail = 0;
    for (const r of runId ? (resultsByRun.get(runId) ?? []) : []) {
      if (!caseIds.has(r.caseId)) continue;
      if (r.status === "pass") pass++;
      else if (r.status === "fail") fail++;
    }
    const total = caseIds.size;
    return {
      id: p.id,
      projectId: p.projectId,
      title: p.title,
      description: p.description,
      gitBranch: p.gitBranch,
      commitHash: p.commitHash,
      repoLabels: p.repoLabels ?? [],
      status: p.status,
      updatedAt: iso(p.updatedAt)!,
      latestRunId: runId,
      counts: { total, pass, fail, notRun: total - pass - fail },
    };
  });
}

export const planPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullish(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    gitBranch: z.string().nullish(),
    commitHash: z.string().nullish(),
    repoLabels: z.array(z.string()).optional(),
  })
  .strict();

/** Partial plan update; bumps updatedAt. Throws NotFoundError if missing. */
export async function updatePlan(planId: number, patch: z.infer<typeof planPatchSchema>) {
  const set: Partial<typeof testPlans.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.gitBranch !== undefined) set.gitBranch = patch.gitBranch;
  if (patch.commitHash !== undefined) set.commitHash = patch.commitHash;
  if (patch.repoLabels !== undefined) {
    const [plan] = await db.select({ projectId: testPlans.projectId }).from(testPlans).where(eq(testPlans.id, planId));
    if (!plan) throw new NotFoundError(`Plan ${planId} not found`);
    await assertKnownRepoLabels(plan.projectId, patch.repoLabels);
    set.repoLabels = patch.repoLabels;
  }
  const [row] = await db
    .update(testPlans)
    .set(set)
    .where(eq(testPlans.id, planId))
    .returning({ id: testPlans.id });
  if (!row) throw new NotFoundError(`Plan ${planId} not found`);
}

/** New run for a plan; default name "Run N" (N = existing run count + 1). */
export async function createRun(planId: number, name?: string): Promise<RunSummary> {
  const [plan] = await db.select({ id: testPlans.id }).from(testPlans).where(eq(testPlans.id, planId));
  if (!plan) throw new NotFoundError(`Plan ${planId} not found`);
  const existing = await db.select({ id: testRuns.id }).from(testRuns).where(eq(testRuns.planId, planId));
  const [run] = await db
    .insert(testRuns)
    .values({ planId, name: name?.trim() || `Run ${existing.length + 1}` })
    .returning();
  return { id: run.id, planId: run.planId, name: run.name, createdAt: iso(run.createdAt)! };
}

/** Clear all results for a run (missing row == not_run). */
export async function resetRun(runId: number): Promise<void> {
  const [run] = await db.select({ id: testRuns.id }).from(testRuns).where(eq(testRuns.id, runId));
  if (!run) throw new NotFoundError(`Run ${runId} not found`);
  await db.delete(testResults).where(eq(testResults.runId, runId));
}

/** Throws NotFoundError / CaseNotInRunError unless caseId belongs to the run's plan. */
export async function assertCaseInRun(runId: number, caseId: number): Promise<void> {
  const [run] = await db.select({ planId: testRuns.planId }).from(testRuns).where(eq(testRuns.id, runId));
  if (!run) throw new NotFoundError(`Run ${runId} not found`);
  const [row] = await db
    .select({ planId: testSections.planId })
    .from(testCases)
    .innerJoin(testSections, eq(testSections.id, testCases.sectionId))
    .where(eq(testCases.id, caseId));
  if (!row || row.planId !== run.planId)
    throw new BadRequestError(`Case ${caseId} does not belong to run ${runId}'s plan`);
}

export class BadRequestError extends Error {}

// ---------- Projects ----------

const repoPathSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || path.isAbsolute(v), { message: "repoPath must be an absolute path" });

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().nullish(),
  /** Legacy single repo; treated as one repo labelled "main" when `repos` is absent. */
  repoPath: repoPathSchema.optional(),
  repos: z.array(repoInputSchema).optional(),
});

export const projectPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullish(),
    /** Legacy: set/replace repo "main"; null removes it. */
    repoPath: repoPathSchema.optional(),
    /** Replaces the whole repo list. */
    repos: z.array(repoInputSchema).optional(),
  })
  .strict();

export type Project = typeof projects.$inferSelect;

export type ProjectWithRepos = {
  id: number;
  name: string;
  description: string | null;
  /** First repo path (compat). */
  repoPath: string | null;
  createdAt: string;
  repos: RepoDTO[];
};

export type ProjectListItem = {
  id: number;
  name: string;
  description: string | null;
  repoPath: string | null;
  repos: RepoDTO[];
  createdAt: string;
  planCount: number;
  /** Latest plan update, or project createdAt when it has no plans. */
  updatedAt: string;
};

/** The user's projects with plan counts, most recently active first. */
export async function listProjects(userId: number): Promise<ProjectListItem[]> {
  const rows = await db
    .select({
      project: projects,
      planCount: count(testPlans.id),
      lastPlanUpdate: max(testPlans.updatedAt),
    })
    .from(projects)
    .leftJoin(testPlans, eq(testPlans.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id);

  const ids = rows.map((r) => r.project.id);
  const repoRows = ids.length
    ? await db
        .select()
        .from(projectRepos)
        .where(inArray(projectRepos.projectId, ids))
        .orderBy(asc(projectRepos.id))
    : [];
  const reposByProject = new Map<number, RepoDTO[]>();
  for (const r of repoRows) {
    const list = reposByProject.get(r.projectId) ?? [];
    list.push({ id: r.id, label: r.label, path: r.path });
    reposByProject.set(r.projectId, list);
  }

  return rows
    .map(({ project: p, planCount, lastPlanUpdate }) => {
      const created = new Date(p.createdAt);
      const last = lastPlanUpdate ? new Date(lastPlanUpdate) : null;
      const updated = last && last > created ? last : created;
      let repos = reposByProject.get(p.id) ?? [];
      // Legacy backfill (read-only): synthesize "main" (id 0) from repo_path.
      if (!repos.length && p.repoPath) repos = [{ id: 0, label: "main", path: p.repoPath }];
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        repoPath: repos[0]?.path ?? null,
        repos,
        createdAt: created.toISOString(),
        planCount: Number(planCount),
        updatedAt: updated.toISOString(),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

/** Project + its repos. Caller must have checked ownership. Throws NotFoundError if missing. */
export async function getProjectWithRepos(projectId: number): Promise<ProjectWithRepos> {
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!p) throw new NotFoundError(`Project ${projectId} not found`);
  const repos = await listRepos(projectId);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    repoPath: repos[0]?.path ?? null,
    createdAt: new Date(p.createdAt).toISOString(),
    repos,
  };
}

export async function createProject(
  userId: number,
  raw: z.input<typeof projectInputSchema>,
): Promise<ProjectWithRepos> {
  const input = projectInputSchema.parse(raw);
  const repos = input.repos ?? (input.repoPath ? [{ label: "main", path: input.repoPath }] : []);
  const labels = new Set<string>();
  for (const r of repos) {
    if (labels.has(r.label.toLowerCase())) throw new BadRequestError(`Duplicate repo label "${r.label}"`);
    labels.add(r.label.toLowerCase());
  }
  const [row] = await db
    .insert(projects)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      repoPath: repos[0]?.path ?? null,
    })
    .returning();
  if (repos.length) {
    try {
      await replaceRepos(row.id, repos);
    } catch (e) {
      await db.delete(projects).where(eq(projects.id, row.id));
      throw e;
    }
  }
  return getProjectWithRepos(row.id);
}

/** Partial project update. Caller must have checked ownership. */
export async function updateProject(
  projectId: number,
  patch: z.infer<typeof projectPatchSchema>,
): Promise<ProjectWithRepos> {
  const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId));
  if (!existing) throw new NotFoundError(`Project ${projectId} not found`);

  // One transaction: a repo validation/duplicate error must not leave name/description half-saved.
  await db.transaction(async (tx) => {
  const set: Partial<typeof projects.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (Object.keys(set).length) await tx.update(projects).set(set).where(eq(projects.id, projectId));

  if (patch.repos !== undefined) {
    await replaceRepos(projectId, patch.repos, tx);
  } else if (patch.repoPath !== undefined) {
    // Legacy: set/replace repo "main" (null removes it), keep the others.
    const newPath = patch.repoPath;
    const current = (await listRepos(projectId, tx)).map(({ label, path: p }) => ({ label, path: p }));
    const hasMain = current.some((r) => r.label === "main");
    let next = current;
    if (newPath === null) next = current.filter((r) => r.label !== "main");
    else if (hasMain) next = current.map((r) => (r.label === "main" ? { ...r, path: newPath } : r));
    // Appended (repos keep id order). projects.repo_path always mirrors the lowest-id repo.
    else next = [...current, { label: "main", path: newPath }];
    await replaceRepos(projectId, next, tx);
  }
  });
  return getProjectWithRepos(projectId);
}

/** Delete a project (cascades to plans, runs, results). Caller must have checked ownership. */
export async function deleteProject(projectId: number): Promise<void> {
  const [row] = await db.delete(projects).where(eq(projects.id, projectId)).returning({ id: projects.id });
  if (!row) throw new NotFoundError(`Project ${projectId} not found`);
}

/** Delete a plan (cascades). Caller must have checked ownership. */
export async function deletePlan(planId: number): Promise<void> {
  const [row] = await db.delete(testPlans).where(eq(testPlans.id, planId)).returning({ id: testPlans.id });
  if (!row) throw new NotFoundError(`Plan ${planId} not found`);
}
