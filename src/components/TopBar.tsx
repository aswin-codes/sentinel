"use client";

import { GitBranch, Plug, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Dropdown } from "./Dropdown";
import type { GitInfo, PlanListItem, Project } from "./types";
import { btnGhost, btnSecondary } from "./ui";

function GitBadge({ projectId, refreshKey }: { projectId: number; refreshKey: number }) {
  const [state, setState] = useState<{ projectId: number; info: GitInfo } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GitInfo>(`/api/projects/${projectId}/git`)
      .then((info) => {
        if (!cancelled) setState({ projectId, info });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ projectId, info: { ok: false, error: e instanceof Error ? e.message : "" } });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  // Keep showing the last value while a refresh for the same project loads.
  const info = state?.projectId === projectId ? state.info : null;

  if (!info) {
    return <span className="hidden h-6 w-24 animate-pulse rounded-full bg-surface-2 sm:block" aria-hidden />;
  }
  if (!info.ok) {
    return (
      <span
        title={info.error ?? "No git repository"}
        className="hidden h-6 items-center gap-1.5 rounded-full border border-line px-2.5 font-mono text-[11.5px] text-muted sm:inline-flex"
      >
        <GitBranch className="size-3" aria-hidden />
        no repo
      </span>
    );
  }
  return (
    <span
      title={info.status || undefined}
      className="hidden h-6 max-w-[260px] items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 font-mono text-[11.5px] text-fg/85 sm:inline-flex"
    >
      <GitBranch className="size-3 shrink-0 text-accent" aria-hidden />
      <span className="truncate">{info.branch}</span>
      {info.commitHash && <span className="shrink-0 text-muted">{info.commitHash}</span>}
    </span>
  );
}

export function TopBar({
  projects,
  projectId,
  onSelectProject,
  plans,
  planId,
  onSelectPlan,
  onNewProject,
  onConnect,
  refreshKey,
}: {
  projects: Project[] | null;
  projectId: number | null;
  onSelectProject: (id: number) => void;
  plans: PlanListItem[] | null;
  planId: number | null;
  onSelectPlan: (id: number) => void;
  onNewProject: () => void;
  onConnect: () => void;
  refreshKey: number;
}) {
  const project = projects?.find((p) => p.id === projectId);
  const plan = plans?.find((p) => p.id === planId);

  return (
    <div className="sticky top-0 z-40 h-[52px] border-b border-line bg-canvas">
      <div className="mx-auto flex h-full max-w-[1240px] items-center gap-1 px-3 sm:px-6">
        <div className="mr-1 flex shrink-0 items-center gap-2 pr-1">
          <span
            aria-hidden
            className="grid size-[22px] place-items-center rounded-[6px] border border-accent/40 bg-accent/10 font-mono text-[10px] font-bold text-accent"
          >
            QA
          </span>
          <span className="hidden text-[14px] font-semibold tracking-[-0.01em] md:inline">QA Hub</span>
        </div>

        {projects && projects.length > 0 && (
          <>
            <span aria-hidden className="text-[18px] font-light text-line-strong">
              /
            </span>
            <div className="min-w-0 max-w-[140px] sm:max-w-[220px]">
              <Dropdown
                ariaLabel="Select project"
                trigger={<span className="font-medium">{project?.name ?? "Project"}</span>}
                items={[
                  ...projects.map((p) => ({
                    key: String(p.id),
                    label: p.name,
                    selected: p.id === projectId,
                    onSelect: () => onSelectProject(p.id),
                  })),
                  {
                    key: "new",
                    label: "New project",
                    icon: <Plus className="size-3.5" />,
                    dividerBefore: true,
                    onSelect: onNewProject,
                  },
                ]}
              />
            </div>
          </>
        )}

        {plans && plans.length > 0 && (
          <>
            <span aria-hidden className="text-[18px] font-light text-line-strong">
              /
            </span>
            <div className="min-w-0 max-w-[150px] sm:max-w-[320px]">
              <Dropdown
                ariaLabel="Select test plan"
                trigger={<span className="text-fg/90">{plan?.title ?? "Plan"}</span>}
                items={plans.map((p) => ({
                  key: String(p.id),
                  label: p.title,
                  meta: `${p.counts.pass + p.counts.fail}/${p.counts.total}`,
                  selected: p.id === planId,
                  onSelect: () => onSelectPlan(p.id),
                }))}
              />
            </div>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {projectId != null && <GitBadge projectId={projectId} refreshKey={refreshKey} />}
          <button type="button" onClick={onNewProject} className={`${btnGhost} hidden px-2.5 lg:inline-flex`}>
            <Plus className="size-3.5" aria-hidden />
            New project
          </button>
          <button type="button" onClick={onConnect} className={`${btnSecondary} px-2.5`} aria-label="Connect agent">
            <Plug className="size-3.5 text-accent" aria-hidden />
            <span className="hidden sm:inline">Connect agent</span>
          </button>
        </div>
      </div>
    </div>
  );
}
