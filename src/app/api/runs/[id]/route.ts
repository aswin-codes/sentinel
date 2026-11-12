import { assertRunOwner } from "@/lib/auth";
import { deleteRun } from "@/lib/runs";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deleting the last remaining run recreates a fresh empty "Run 1" (plans always keep >= 1 run).
export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRequestUser(req);
  const id = parseId((await params).id);
  await assertRunOwner(user.id, id);
  const result = await deleteRun(id);
  return ok({ ok: true, ...result });
});
