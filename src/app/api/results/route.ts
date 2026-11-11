import { z } from "zod";
import { assertCaseInRun, setResult } from "@/lib/plans";
import { handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resultInputSchema = z
  .object({
    runId: z.number().int().positive(),
    caseId: z.number().int().positive(),
    status: z.enum(["not_run", "pass", "fail"]).optional(),
    notes: z.string().max(10_000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, {
    message: "Provide at least one of status or notes",
  });

export const PATCH = handle(async (req: Request) => {
  const input = resultInputSchema.parse(await readJson(req));
  await assertCaseInRun(input.runId, input.caseId);
  return ok(await setResult(input));
});
