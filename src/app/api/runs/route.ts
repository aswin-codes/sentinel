import { z } from "zod";
import { assertPlanOwner } from "@/lib/auth";
import { createRun } from "@/lib/plans";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runInputSchema = z.object({
  planId: z.number().int().positive(),
  name: z.string().trim().max(120).nullish(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireRequestUser(req);
  const input = runInputSchema.parse(await readJson(req));
  await assertPlanOwner(user.id, input.planId);
  return ok(await createRun(input.planId, input.name ?? undefined), 201);
});
