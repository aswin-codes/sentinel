import { assertProjectOwner } from "@/lib/auth";
import { deleteProject, getProjectWithRepos, projectPatchSchema, updateProject } from "@/lib/plans";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, parseId, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRequestUser(req);
  const id = parseId((await params).id);
  await assertProjectOwner(user.id, id);
  return ok(await getProjectWithRepos(id));
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRequestUser(req);
  const id = parseId((await params).id);
  await assertProjectOwner(user.id, id);
  const patch = projectPatchSchema.parse(await readJson(req));
  return ok(await updateProject(id, patch));
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRequestUser(req);
  const id = parseId((await params).id);
  await assertProjectOwner(user.id, id);
  await deleteProject(id);
  return ok({ ok: true });
});
