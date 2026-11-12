import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/ProjectView";
import type { McpSetup, ProjectDTO } from "@/components/types";
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
  return <ProjectView project={project} plans={plans} mcp={mcp} />;
}

/**
 * How agents should connect, for the Connect-agent dialog:
 * - cloud (Vercel, or SENTINEL_HOSTED=1): the hosted Streamable HTTP endpoint at <origin>/api/mcp.
 * - local (`npm run dev` on your machine): the stdio server from this checkout (process.cwd()).
 */
async function mcpSetup(): Promise<McpSetup> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  const appUrl = `${proto}://${host}`;
  const cloud = Boolean(process.env.VERCEL) || process.env.SENTINEL_HOSTED === "1";
  return cloud
    ? { mode: "cloud", appUrl }
    : { mode: "local", appUrl, appDir: process.cwd().split("\\").join("/") };
}
