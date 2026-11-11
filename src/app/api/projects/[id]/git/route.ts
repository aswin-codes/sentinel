import { assertProjectOwner } from "@/lib/auth";
import { getGitInfo } from "@/lib/git";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRequestUser(req);
  const project = await assertProjectOwner(user.id, parseId((await params).id));
  // 200 even when ok:false so the UI can show the reason.
  return ok(await getGitInfo(project.repoPath));
});
