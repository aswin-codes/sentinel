import { NextRequest } from "next/server";
import { getPlanFull, planPatchSchema, updatePlan } from "@/lib/plans";
import { handle, ok, parseId, readJson, HttpError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  const runParam = req.nextUrl.searchParams.get("runId");
  const runId = runParam ? parseId(runParam, "runId") : undefined;
  const plan = await getPlanFull(id, runId);
  if (!plan) throw new HttpError(404, `Plan ${id} not found`);
  return ok(plan);
});

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  const patch = planPatchSchema.parse(await readJson(req));
  await updatePlan(id, patch);
  const plan = await getPlanFull(id);
  if (!plan) throw new HttpError(404, `Plan ${id} not found`);
  return ok(plan);
});
