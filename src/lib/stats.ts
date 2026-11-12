import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "../db";
import { projects, testCases, testPlans, testResults, testRuns, testSections } from "../db/schema";

export type Counts = { total: number; pass: number; fail: number; notRun: number };

export type PlanStat = {
  planId: number;
  title: string;
  status: string;
  runCount: number;
  latestRunId: number | null;
  counts: Counts;
  passRate: number;
};

export type FailingCase = {
  caseId: number;
  code: string;
  title: string;
  sectionCode: string;
  planId: number;
  planTitle: string;
  failCount: number;
  runCount: number;
  lastFailedAt: string | null;
};

export type TrendPoint = {
  runId: number;
  planId: number;
  planTitle: string;
  runName: string;
  createdAt: string;
  total: number;
  pass: number;
  fail: number;
  notRun: number;
};

export type ProjectStats = {
  projectId: number;
  planCount: number;
  runCount: number;
  caseCount: number;
  counts: Counts;
  passRate: number;
  failRate: number;
  notRunRate: number;
  plans: PlanStat[];
  mostFailing: FailingCase[];
  trend: TrendPoint[];
};

export type UserStatsSummary = {
  projectCount: number;
  planCount: number;
  runCount: number;
  caseCount: number;
  counts: Counts;
  passRate: number;
  failRate: number;
  notRunRate: number;
  perProject: { projectId: number; name: string; planCount: number; counts: Counts }[];
};

const emptyCounts = (): Counts => ({ total: 0, pass: 0, fail: 0, notRun: 0 });
const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);

function addCounts(a: Counts, b: Counts) {
  a.total += b.total;
  a.pass += b.pass;
  a.fail += b.fail;
  a.notRun += b.notRun;
}

function rates(c: Counts) {
  return {
    passRate: ratio(c.pass, c.total),
    failRate: ratio(c.fail, c.total),
    notRunRate: ratio(c.notRun, c.total),
  };
}

type PlanRow = { id: number; projectId: number; title: string; status: string };
type RunRow = { id: number; planId: number; name: string; createdAt: Date };

type Base = {
  plans: PlanRow[];
  runs: RunRow[]; // chronological ASC (createdAt, id)
  caseTotals: Map<number, number>; // planId -> current case count
  runCounts: Map<number, { pass: number; fail: number }>; // runId -> counts
};

/** Shared loader: 4 grouped queries regardless of how many projects/plans/runs. */
async function loadBase(projectIds: number[]): Promise<Base> {
  if (projectIds.length === 0) {
    return { plans: [], runs: [], caseTotals: new Map(), runCounts: new Map() };
  }

  const plans = await db
    .select({
      id: testPlans.id,
      projectId: testPlans.projectId,
      title: testPlans.title,
      status: testPlans.status,
    })
    .from(testPlans)
    .where(inArray(testPlans.projectId, projectIds));
  const planIds = plans.map((p) => p.id);
  if (planIds.length === 0) {
    return { plans, runs: [], caseTotals: new Map(), runCounts: new Map() };
  }

  const [runs, caseRows] = await Promise.all([
    db
      .select({
        id: testRuns.id,
        planId: testRuns.planId,
        name: testRuns.name,
        createdAt: testRuns.createdAt,
      })
      .from(testRuns)
      .where(inArray(testRuns.planId, planIds))
      .orderBy(testRuns.createdAt, testRuns.id),
    db
      .select({ planId: testSections.planId, n: count() })
      .from(testCases)
      .innerJoin(testSections, eq(testSections.id, testCases.sectionId))
      .where(inArray(testSections.planId, planIds))
      .groupBy(testSections.planId),
  ]);

  const caseTotals = new Map(caseRows.map((r) => [r.planId, Number(r.n)]));
  const runCounts = new Map<number, { pass: number; fail: number }>();

  if (runs.length > 0) {
    // inner join on test_cases => results for cases deleted since are ignored (they cascade anyway)
    const resultRows = await db
      .select({ runId: testResults.runId, status: testResults.status, n: count() })
      .from(testResults)
      .innerJoin(testCases, eq(testCases.id, testResults.caseId))
      .where(
        and(
          inArray(
            testResults.runId,
            runs.map((r) => r.id),
          ),
          inArray(testResults.status, ["pass", "fail"]),
        ),
      )
      .groupBy(testResults.runId, testResults.status);
    for (const r of resultRows) {
      const cur = runCounts.get(r.runId) ?? { pass: 0, fail: 0 };
      if (r.status === "pass") cur.pass = Number(r.n);
      else if (r.status === "fail") cur.fail = Number(r.n);
      runCounts.set(r.runId, cur);
    }
  }

  return { plans, runs, caseTotals, runCounts };
}

function countsForRun(base: Base, planId: number, runId: number | null): Counts {
  const total = base.caseTotals.get(planId) ?? 0;
  const rc = runId == null ? undefined : base.runCounts.get(runId);
  const pass = Math.min(rc?.pass ?? 0, total);
  const fail = Math.min(rc?.fail ?? 0, total - pass);
  return { total, pass, fail, notRun: total - pass - fail };
}

/** Latest run per plan (runs are already sorted ASC, so last wins) + run counts per plan. */
function indexRuns(runs: RunRow[]) {
  const latest = new Map<number, number>();
  const perPlan = new Map<number, number>();
  for (const r of runs) {
    latest.set(r.planId, r.id);
    perPlan.set(r.planId, (perPlan.get(r.planId) ?? 0) + 1);
  }
  return { latest, perPlan };
}

export async function getProjectStats(
  projectId: number,
  opts: { trendLimit?: number; failingLimit?: number } = {},
): Promise<ProjectStats> {
  const trendLimit = Math.max(0, opts.trendLimit ?? 12);
  const failingLimit = Math.max(0, opts.failingLimit ?? 10);
  const base = await loadBase([projectId]);
  const { latest, perPlan } = indexRuns(base.runs);

  const total = emptyCounts();
  const planStats: PlanStat[] = base.plans
    .map((p) => {
      const latestRunId = latest.get(p.id) ?? null;
      const counts = countsForRun(base, p.id, latestRunId);
      addCounts(total, counts);
      return {
        planId: p.id,
        title: p.title,
        status: p.status,
        runCount: perPlan.get(p.id) ?? 0,
        latestRunId,
        counts,
        passRate: ratio(counts.pass, counts.total),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const planTitle = new Map(base.plans.map((p) => [p.id, p.title]));
  const trend: TrendPoint[] =
    trendLimit === 0
      ? []
      : base.runs.slice(-trendLimit).map((r) => {
          const c = countsForRun(base, r.planId, r.id);
          return {
            runId: r.id,
            planId: r.planId,
            planTitle: planTitle.get(r.planId) ?? "",
            runName: r.name,
            createdAt: r.createdAt.toISOString(),
            total: c.total,
            pass: c.pass,
            fail: c.fail,
            notRun: c.notRun,
          };
        });

  let mostFailing: FailingCase[] = [];
  if (failingLimit > 0 && base.runs.length > 0) {
    const failCount = count();
    const lastFailed = max(testResults.updatedAt);
    const rows = await db
      .select({
        caseId: testCases.id,
        code: testCases.code,
        title: testCases.title,
        sectionCode: testSections.code,
        planId: testSections.planId,
        failCount,
        lastFailedAt: lastFailed,
      })
      .from(testResults)
      .innerJoin(testCases, eq(testCases.id, testResults.caseId))
      .innerJoin(testSections, eq(testSections.id, testCases.sectionId))
      .where(
        and(
          inArray(
            testResults.runId,
            base.runs.map((r) => r.id),
          ),
          eq(testResults.status, "fail"),
        ),
      )
      .groupBy(testCases.id, testCases.code, testCases.title, testSections.code, testSections.planId)
      .orderBy(desc(failCount), desc(lastFailed), testCases.id)
      .limit(failingLimit);
    mostFailing = rows.map((r) => ({
      caseId: r.caseId,
      code: r.code,
      title: r.title,
      sectionCode: r.sectionCode,
      planId: r.planId,
      planTitle: planTitle.get(r.planId) ?? "",
      failCount: Number(r.failCount),
      runCount: perPlan.get(r.planId) ?? 0,
      lastFailedAt: r.lastFailedAt ? new Date(r.lastFailedAt as unknown as string | Date).toISOString() : null,
    }));
  }

  return {
    projectId,
    planCount: base.plans.length,
    runCount: base.runs.length,
    caseCount: [...base.caseTotals.values()].reduce((a, b) => a + b, 0),
    counts: total,
    ...rates(total),
    plans: planStats,
    mostFailing,
    trend,
  };
}

export async function getUserStatsSummary(userId: number): Promise<UserStatsSummary> {
  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(projects.id);
  const base = await loadBase(projectRows.map((p) => p.id));
  const { latest } = indexRuns(base.runs);

  const byProject = new Map(
    projectRows.map((p) => [p.id, { projectId: p.id, name: p.name, planCount: 0, counts: emptyCounts() }]),
  );
  const total = emptyCounts();
  for (const plan of base.plans) {
    const c = countsForRun(base, plan.id, latest.get(plan.id) ?? null);
    const entry = byProject.get(plan.projectId);
    if (!entry) continue;
    entry.planCount += 1;
    addCounts(entry.counts, c);
    addCounts(total, c);
  }

  return {
    projectCount: projectRows.length,
    planCount: base.plans.length,
    runCount: base.runs.length,
    caseCount: [...base.caseTotals.values()].reduce((a, b) => a + b, 0),
    counts: total,
    ...rates(total),
    perProject: [...byProject.values()],
  };
}

