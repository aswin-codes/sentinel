import { resetRun } from "@/lib/plans";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await resetRun(parseId((await params).id));
  return ok({ ok: true });
});
