"use client";

import { GitBranch, MoreHorizontal, Plug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { ConnectAgentModal, examplePrompt } from "./ConnectAgentModal";
import { CopyButton } from "./CopyButton";
import { Menu } from "./Menu";
import { ConfirmModal } from "./Modal";
import { ProgressBar } from "./Progress";
import { ProjectFormModal } from "./ProjectFormModal";
import { Skeleton } from "./Skeleton";
import { StatsPanel } from "./stats/StatsPanel";
import { relativeTime } from "./time";
import { useToast } from "./Toast";
import type { McpSetup, PlanListItem, ProjectDTO, ProjectStats, RepoGitInfo } from "./types";
import { btnGhost, btnSecondary } from "./ui";

type Tab = "plans" | "stats";

export function ProjectView({
  project: initialProject,
  plans,
  mcp,
  initialTab = "plans",
}: {
  project: ProjectDTO;
  plans: PlanListItem[];
  mcp: McpSetup;
  initialTab?: Tab;
}) {
  const router = useRouter();
  const toast = useToast();
  const [project, setProject] = useState(initialProject);
  const [tab, setTab] = useState<Tab>(initialTab);
  // Stats are fetched lazily when the Stats tab is open (not on every page load / focus refresh).
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [gitRepos, setGitRepos] = useState<RepoGitInfo[] | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanListItem | null>(null);

  const repos = project.repos;
  const repoKey = repos.map((r) => `${r.label}\u0000${r.path}`).join("\u0001");
  const loadGit = useCallback(() => {
    if (!repoKey) return () => {};
    let cancelled = false;
    api<{ repos: RepoGitInfo[] }>(`/api/projects/${project.id}/git`)
      .then((g) => !cancelled && setGitRepos(g.repos))
      .catch(() => !cancelled && setGitRepos([]));
    return () => {
      cancelled = true;
    };
  }, [project.id, repoKey]);

  useEffect(() => {
    setGitRepos(null);
    return loadGit();
  }, [loadGit]);

  const loadStats = useCallback(() => {
    let cancelled = false;
    setStatsError(false);
    api<ProjectStats>(`/api/projects/${project.id}/stats`)
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setStatsError(true));
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (tab !== "stats") return;
    return loadStats();
  }, [tab, loadStats, plans]);

  const selectTab = (t: Tab) => {
    setTab(t);
    try {
      const url = new URL(window.location.href);
      if (t === "stats") url.searchParams.set("tab", "stats");
      else url.searchParams.delete("tab");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* URL sync is a nicety */
    }
  };

  // Agents add plans in the background: refresh server data when the tab regains focus.
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last < 5000) return;
      last = Date.now();
      router.refresh();
      loadGit();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router, loadGit]);

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
          <ul className="mt-3 space-y-1.5 text-[12.5px]" aria-label="Repositories">
            {repos.length === 0 && <li className="text-subtle">No repositories</li>}
            {repos.map((r) => {
              const g = gitRepos?.find((x) => x.label === r.label);
              return (
                <li key={r.label} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  {repos.length > 1 || r.label !== "main" ? (
                    <span className="shrink-0 rounded-[5px] border border-line px-1.5 py-0.5 text-[11.5px] text-muted">
                      {r.label}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate font-mono text-subtle" title={r.path}>
                    {r.path}
                  </span>
                  {gitRepos === null ? (
                    <Skeleton className="h-5 w-24" />
                  ) : g?.ok ? (
                    <>
                      {g.branch && (
                        <span className="inline-flex items-center gap-1 rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-muted">
                          <GitBranch className="size-3" aria-hidden />
                          {g.branch}
                        </span>
                      )}
                      {g.commitHash && <span className="font-mono text-[11.5px] text-subtle">{g.commitHash}</span>}
                      {isDirty(g.status) && <span className="text-[11.5px] text-muted">· uncommitted changes</span>}
                    </>
                  ) : (
                    <span className="text-subtle">· {g?.error ? shortReason(g.error) : "Could not read repository"}</span>
                  )}
                </li>
              );
            })}
          </ul>
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

      <div role="tablist" aria-label="Project sections" className="mt-10 flex gap-5 border-b border-line">
        {(["plans", "stats"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => selectTab(t)}
            className={`-mb-px border-b-2 pb-2.5 text-[13.5px] font-medium transition-colors ${
              tab === t ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t === "plans" ? `Plans${plans.length ? ` (${plans.length})` : ""}` : "Stats"}
          </button>
        ))}
      </div>

      {tab === "stats" && (
        <section role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" className="mt-5">
          {stats ? (
            <StatsPanel stats={stats} projectId={project.id} />
          ) : statsError ? (
            <p className="text-[13px] text-muted">
              Couldn’t load stats.{" "}
              <button type="button" onClick={loadStats} className="underline underline-offset-2 hover:text-fg">
                Retry
              </button>
            </p>
          ) : (
            <div role="status" aria-busy="true" aria-label="Loading stats" className="mt-3 space-y-10">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="bg-bg px-4 py-3.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="mt-2.5 h-6 w-12" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </section>
      )}

      <section
        role="tabpanel"
        id="panel-plans"
        aria-labelledby="tab-plans"
        hidden={tab !== "plans"}
        className="mt-5"
      >
        {plans.length === 0 ? (
          <div className="rounded-[8px] border border-line px-6 py-14 text-center">
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
          <ul className="divide-y divide-line overflow-hidden rounded-[8px] border border-line">
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
                        {p.repoLabels?.map((l) => (
                          <span key={l} className="rounded-[5px] border border-line px-1.5 text-[11.5px] text-muted">
                            {l}
                          </span>
                        ))}
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
        mcp={mcp}
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
        confirmText={project.name}
        pendingLabel="Deleting…"
        danger
        onConfirm={deleteProject}
      />
      <ConfirmModal
        open={!!planToDelete}
        onClose={() => setPlanToDelete(null)}
        title="Delete test plan?"
        description={planToDelete ? `“${planToDelete.title}” and all of its runs will be permanently deleted.` : undefined}
        confirmLabel="Delete plan"
        pendingLabel="Deleting…"
        danger
        onConfirm={deletePlan}
      />
    </>
  );
}

function isDirty(status?: string) {
  // `git status --short --branch`: first line is the branch header; any further line is a change.
  return !!status && status.split("\n").filter((l) => l.trim()).length > 1;
}

function shortReason(err: string) {
  return /not a git|does not exist|no such/i.test(err) ? "Not a git repository or path missing" : "Could not read repository";
}
