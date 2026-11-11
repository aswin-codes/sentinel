/**
 * Shared plan service — used by API route handlers AND the MCP server.
 * Keep imports relative (no "@/") so tsx can run mcp-server without path aliases.
 */
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  projects,
  testCases,
  testPlans,
  testResults,
  testRuns,
  testSections,
  type ResultStatus,
  type Tag,
} from "../db/schema";

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
    status: p.status,
    createdAt: iso(p.createdAt)!,
    updatedAt: iso(p.updatedAt)!,
    sections: sectionsFull,
    runs: runs.map((r) => ({ id: r.id, planId: r.planId, name: r.name, createdAt: iso(r.createdAt)! })),
    activeRunId,
    counts,
  };
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
      throw new Error(`Plan ${existing.id} belongs to a different project`);

    const fields = {
      title: input.planTitle,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.gitBranch !== undefined && { gitBranch: input.gitBranch }),
      ...(input.commitHash !== undefined && { commitHash: input.commitHash }),
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
