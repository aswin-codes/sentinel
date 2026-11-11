import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanView } from "@/components/PlanView";
import { parsePositiveId } from "@/components/url";
import { assertPlanOwner } from "@/lib/auth";
import { ensureRun, getPlanFull, type PlanFull } from "@/lib/plans";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string; planId: string }>;
type Search = Promise<{ run?: string | string[] }>;

async function loadPlan(
  userId: number,
  projectId: string,
  planId: string,
  opts: { run?: string; ensure?: boolean } = {},
): Promise<PlanFull> {
  const pid = parsePositiveId(projectId);
  const id = parsePositiveId(planId);
  if (!pid || !id) notFound();
  let owner: Awaited<ReturnType<typeof assertPlanOwner>>;
  try {
    owner = await assertPlanOwner(userId, id);
  } catch {
    notFound();
  }
  if (owner.projectId !== pid) notFound();

  let plan = await getPlanFull(id, parsePositiveId(opts.run) ?? undefined);
  if (opts.ensure && plan && plan.activeRunId == null) {
    // Every plan should have a run; create one lazily if an old plan has none.
    await ensureRun(id);
    plan = await getPlanFull(id);
  }
  if (!plan) notFound();
  return plan;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { projectId, planId } = await params;
  const user = await requireUser();
  const plan = await loadPlan(user.id, projectId, planId);
  return { title: plan.title };
}

export default async function PlanPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ projectId, planId }, { run }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const plan = await loadPlan(user.id, projectId, planId, {
    run: typeof run === "string" ? run : undefined,
    ensure: true,
  });
  return <PlanView key={`${plan.id}:${plan.activeRunId}`} initialPlan={plan} />;
}
