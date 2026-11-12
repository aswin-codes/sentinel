import type { Metadata } from "next";
import { ProjectsView } from "@/components/ProjectsView";
import { listProjects } from "@/lib/plans";
import { getUserStatsSummary } from "@/lib/stats";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const [projects, summary] = await Promise.all([listProjects(user.id), getUserStatsSummary(user.id)]);
  return <ProjectsView projects={projects} summary={summary} />;
}
