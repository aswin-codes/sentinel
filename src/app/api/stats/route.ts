import { getUserStatsSummary } from "@/lib/stats";
import { requireRequestUser } from "@/lib/session";
import { handle, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireRequestUser(req);
  return ok(await getUserStatsSummary(user.id));
});
