import { NextRequest } from "next/server";
import { assertPlanOwner, assertProjectOwner } from "@/lib/auth";
import { getPlanFull, listPlans, upsertPlan, planInputSchema } from "@/lib/plans";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId, readJson, HttpError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRequestUser(req);
  const projectId = parseId(req.nextUrl.searchParams.get("projectId"), "projectId");
  await assertProjectOwner(user.id, projectId);
  return ok(await listPlans(projectId));
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRequestUser(req);
  const input = planInputSchema.parse(await readJson(req));
  await assertProjectOwner(user.id, input.projectId);
  if (input.planId) await assertPlanOwner(user.id, input.planId);
  const { planId, created } = await upsertPlan(input);
  const plan = await getPlanFull(planId);
  if (!plan) throw new HttpError(500, "Plan vanished after upsert");
  return ok(plan, created ? 201 : 200);
});
