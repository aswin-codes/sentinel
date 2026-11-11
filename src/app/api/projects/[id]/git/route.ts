import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getGitInfo } from "@/lib/git";
import { handle, ok, parseId, HttpError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = parseId((await params).id);
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) throw new HttpError(404, `Project ${id} not found`);
  // 200 even when ok:false so the UI can show the reason.
  return ok(await getGitInfo(project.repoPath));
});
