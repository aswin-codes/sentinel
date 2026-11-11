import type { Metadata } from "next";
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
  const appDir = process.cwd().replace(/\\/g, "/");
  return <ProjectView project={project} plans={plans} appDir={appDir} />;
}
