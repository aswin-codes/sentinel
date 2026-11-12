import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { testPlans, testRuns } from "../db/schema";
import { NotFoundError } from "./plans";

/**
 * Delete one run (its results cascade). Invariant: every plan keeps >= 1 run, so deleting the
 * last remaining run recreates a fresh empty "Run 1" instead of failing.
 */
export async function deleteRun(
  runId: number,
): Promise<{ deletedRunId: number; nextRunId: number; recreated: boolean }> {
  return db.transaction(async (tx) => {
    const [run] = await tx.select().from(testRuns).where(eq(testRuns.id, runId));
    if (!run) throw new NotFoundError(`Run ${runId} not found`);

    // Serialize concurrent deletes for the same plan so the "latest remaining run" check below is accurate.
    await tx.select({ id: testPlans.id }).from(testPlans).where(eq(testPlans.id, run.planId)).for("update");

    await tx.delete(testRuns).where(and(eq(testRuns.id, runId), eq(testRuns.planId, run.planId)));

    const [latest] = await tx
      .select({ id: testRuns.id })
      .from(testRuns)
      .where(eq(testRuns.planId, run.planId))
      .orderBy(desc(testRuns.createdAt), desc(testRuns.id))
      .limit(1);
    if (latest) return { deletedRunId: runId, nextRunId: latest.id, recreated: false };

    const [created] = await tx
      .insert(testRuns)
      .values({ planId: run.planId, name: "Run 1" })
      .returning({ id: testRuns.id });
    return { deletedRunId: runId, nextRunId: created.id, recreated: true };
  });
}
