import { revokeApiToken } from "@/lib/auth";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRequestUser(req);
  await revokeApiToken(user.id, parseId((await params).id));
  return ok({ ok: true });
});
