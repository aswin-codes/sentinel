import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/ProjectView";
import type { ProjectDTO } from "@/components/types";
import { parsePositiveId } from "@/components/url";
import { assertProjectOwner } from "@/lib/auth";
import { listPlans } from "@/lib/plans";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string }>;

async function loadProject(userId: number, projectId: string): Promise<ProjectDTO> {
  const id = parsePositiveId(projectId);
  if (!id) notFound();
  let p: Awaited<ReturnType<typeof assertProjectOwner>>;
  try {
    p = await assertProjectOwner(userId, id);
  } catch {
    notFound();
  }
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    repoPath: p.repoPath,
    createdAt: new Date(p.createdAt).toISOString(),
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await loadProject(user.id, projectId);
  return { title: project.name };
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await loadProject(user.id, projectId);
  const plans = await listPlans(project.id);
  const mcp = await mcpSetup();
  return <ProjectView project={project} plans={plans} appDir={mcp.appDir} appUrl={mcp.appUrl} />;
}

/**
 * Where the MCP server lives for the Connect-agent snippets. The MCP server always runs on the
 * user's machine. Locally, that's this checkout (process.cwd()). When hosted (e.g. Vercel, where
 * cwd is /var/task), the server's path means nothing to the user, so we return null → placeholder,
 * plus the public URL so plan links returned to the agent point at the deployment.
 * SENTINEL_LOCAL_DIR overrides the path if you want the snippet prefilled anyway.
 */
async function mcpSetup(): Promise<{ appDir: string | null; appUrl: string | null }> {
  const hosted = Boolean(process.env.VERCEL) || process.env.SENTINEL_HOSTED === "1";
  const override = process.env.SENTINEL_LOCAL_DIR?.replace(/\\/g, "/").replace(/\/$/, "") || null;
  if (!hosted) return { appDir: override ?? process.cwd().replace(/\\/g, "/"), appUrl: null };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return { appDir: override, appUrl: host ? `${proto}://${host}` : null };
}
