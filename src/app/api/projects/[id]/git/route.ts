import { assertProjectOwner } from "@/lib/auth";
import { getProjectGit } from "@/lib/repos";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRequestUser(req);
  const project = await assertProjectOwner(user.id, parseId((await params).id));
  // 200 even when a repo has ok:false so the UI can show the reason per repo.
  return ok(await getProjectGit(project.id));
});
