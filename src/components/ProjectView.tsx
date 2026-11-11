"use client";

import { GitBranch, MoreHorizontal, Plug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";
import { ConnectAgentModal, examplePrompt } from "./ConnectAgentModal";
import { CopyButton } from "./CopyButton";
import { Menu } from "./Menu";
import { ConfirmModal } from "./Modal";
import { ProgressBar } from "./Progress";
import { ProjectFormModal } from "./ProjectFormModal";
import { relativeTime } from "./time";
import { useToast } from "./Toast";
import type { GitInfo, PlanListItem, ProjectDTO } from "./types";
import { btnGhost, btnSecondary } from "./ui";

export function ProjectView({
  project: initialProject,
  plans,
  appDir,
}: {
  project: ProjectDTO;
  plans: PlanListItem[];
  appDir: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [project, setProject] = useState(initialProject);
  const [git, setGit] = useState<GitInfo | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanListItem | null>(null);

  const repoPath = project.repoPath;
  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    api<GitInfo>(`/api/projects/${project.id}/git`)
      .then((g) => !cancelled && setGit(g))
      .catch(() => !cancelled && setGit({ ok: false, error: "Couldn't read repository" }));
    return () => {
      cancelled = true;
    };
  }, [project.id, repoPath]);

  // Agents add plans in the background: refresh server data when the tab regains focus.
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last < 5000) return;
      last = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const deleteProject = async () => {
    await api(`/api/projects/${project.id}`, { method: "DELETE" });
    router.push("/projects");
    router.refresh();
  };

  const deletePlan = async () => {
    if (!planToDelete) return;
    await api(`/api/plans/${planToDelete.id}`, { method: "DELETE" });
    setPlanToDelete(null);
    toast(`Deleted “${planToDelete.title}”`, "info");
    router.refresh();
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <Link href="/projects" className="hover:text-fg">
          Projects
        </Link>
        <span className="mx-1.5 text-subtle">/</span>
        <span className="text-fg">{project.name}</span>
      </nav>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">{project.name}</h1>
          {project.description && (
            <p className="mt-1.5 max-w-[640px] text-[14px] leading-relaxed text-muted">{project.description}</p>
          )}
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
            {repoPath ? (
              <>
                <span className="min-w-0 truncate font-mono text-subtle" title={repoPath}>
                  {repoPath}
                </span>
                {git?.ok && git.branch && (
                  <span className="inline-flex items-center gap-1 rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-muted">
                    <GitBranch className="size-3" aria-hidden />
                    {git.branch}
                  </span>
                )}
                {git && !git.ok && <span className="text-subtle">· Not a git repository</span>}
              </>
            ) : (
              <span className="text-subtle">No repository</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setConnectOpen(true)} className={btnSecondary}>
            <Plug className="size-3.5" aria-hidden />
            Connect agent
          </button>
          <Menu
            ariaLabel="Project actions"
            triggerClassName={`${btnGhost} w-8 px-0`}
            trigger={<MoreHorizontal className="size-4" />}
            items={[
              {
                key: "edit",
                label: "Edit project",
                onSelect: () => {
                  setEditKey((k) => k + 1);
                  setEditOpen(true);
                },
              },
              { key: "delete", label: "Delete project", danger: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-[14px] font-medium">Test plans</h2>
        {plans.length === 0 ? (
          <div className="mt-3 rounded-[8px] border border-line px-6 py-14 text-center">
            <h3 className="text-[15px] font-medium">No test plans yet</h3>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[13.5px] leading-relaxed text-muted">
              Plans are written by your coding agent. Connect it, then ask it to look at your changes:
            </p>
            <div className="mx-auto mt-5 flex max-w-[520px] items-start gap-3 rounded-[8px] border border-line bg-surface px-3 py-2.5 text-left">
              <p className="min-w-0 flex-1 text-[13px]">{examplePrompt(project.name)}</p>
              <CopyButton
                text={examplePrompt(project.name)}
                iconOnly
                label="Copy example prompt"
                className="h-6 shrink-0 px-1.5"
              />
            </div>
            <button type="button" onClick={() => setConnectOpen(true)} className={`${btnSecondary} mt-5`}>
              <Plug className="size-3.5" aria-hidden />
              Connect agent
            </button>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[8px] border border-line">
            {plans.map((p) => {
              const done = p.counts.pass + p.counts.fail;
              return (
                <li key={p.id} className="relative flex items-center gap-2 transition-colors hover:bg-surface">
                  <Link
                    href={`/projects/${project.id}/plans/${p.id}`}
                    className="grid min-w-0 flex-1 gap-2 py-3.5 pl-4 sm:grid-cols-[minmax(0,1fr)_150px_88px] sm:items-center sm:gap-6"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{p.title}</div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
                        <span className="capitalize">{p.status}</span>
                        {p.gitBranch && (
                          <>
                            <span className="text-subtle">·</span>
                            <span className="truncate font-mono text-[12px]">{p.gitBranch}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar counts={p.counts} className="w-full max-w-[90px] flex-1" />
                      <span className="shrink-0 text-[12.5px] tabular-nums text-muted">
                        {done}/{p.counts.total}
                      </span>
                    </div>
                    <div className="text-[12.5px] text-muted sm:text-right" suppressHydrationWarning>
                      {relativeTime(p.updatedAt)}
                    </div>
                  </Link>
                  <div className="pr-2">
                    <Menu
                      ariaLabel={`Actions for ${p.title}`}
                      triggerClassName={`${btnGhost} w-8 px-0`}
                      trigger={<MoreHorizontal className="size-4" />}
                      items={[{ key: "delete", label: "Delete plan", danger: true, onSelect: () => setPlanToDelete(p) }]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConnectAgentModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        appDir={appDir}
        projectName={project.name}
      />
      <ProjectFormModal
        key={editKey}
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onSaved={(p) => {
          setProject(p);
          setEditOpen(false);
          router.refresh();
        }}
      />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${project.name}?`}
        description="All of its test plans, runs and results will be permanently deleted."
        confirmLabel="Delete project"
        danger
        onConfirm={deleteProject}
      />
      <ConfirmModal
        open={!!planToDelete}
        onClose={() => setPlanToDelete(null)}
        title="Delete test plan?"
        description={planToDelete ? `“${planToDelete.title}” and all of its runs will be permanently deleted.` : undefined}
        confirmLabel="Delete plan"
        danger
        onConfirm={deletePlan}
      />
    </>
  );
}
