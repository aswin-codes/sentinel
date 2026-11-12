import { assertProjectOwner } from "@/lib/auth";
import { getProjectStats } from "@/lib/stats";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRequestUser(req);
  const id = parseId((await params).id);
  await assertProjectOwner(user.id, id);
  return ok(await getProjectStats(id));
});
