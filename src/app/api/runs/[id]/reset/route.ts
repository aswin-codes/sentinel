import { assertRunOwner } from "@/lib/auth";
import { resetRun } from "@/lib/plans";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRequestUser(req);
  const id = parseId((await params).id);
  await assertRunOwner(user.id, id);
  await resetRun(id);
  return ok({ ok: true });
});
