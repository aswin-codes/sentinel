import { NextRequest } from "next/server";
import { getPlanFull, listPlans, upsertPlan, planInputSchema } from "@/lib/plans";
import { handle, ok, parseId, readJson, HttpError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  const projectId = parseId(req.nextUrl.searchParams.get("projectId"), "projectId");
  return ok(await listPlans(projectId));
});

export const POST = handle(async (req: NextRequest) => {
  const input = planInputSchema.parse(await readJson(req));
  const { planId, created } = await upsertPlan(input);
  const plan = await getPlanFull(planId);
  if (!plan) throw new HttpError(500, "Plan vanished after upsert");
  return ok(plan, created ? 201 : 200);
});
