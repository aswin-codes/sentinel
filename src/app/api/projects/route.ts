import { createProject, listProjects } from "@/lib/plans";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireRequestUser(req);
  return ok(await listProjects(user.id));
});

export const POST = handle(async (req: Request) => {
  const user = await requireRequestUser(req);
  const body = (await readJson(req)) as Parameters<typeof createProject>[1];
  return ok(await createProject(user.id, body), 201);
});
