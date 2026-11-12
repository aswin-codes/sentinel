"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectFormModal } from "./ProjectFormModal";
import { relativeTime } from "./time";
import type { ProjectListItem, UserStatsSummary } from "./types";
import { btnPrimary } from "./ui";

type Counts = { total: number; pass: number; fail: number; notRun: number };

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Thin stacked pass / fail / not-run bar. Color only for pass and fail. */
function StackBar({ counts, className = "" }: { counts: Counts; className?: string }) {
  const t = counts.total;
  const label = t
    ? `${counts.pass} passed, ${counts.fail} failed, ${counts.notRun} not run`
    : "No test cases";
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`flex h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      {t > 0 && (
        <>
          <span className="bg-pass" style={{ width: `${(counts.pass / t) * 100}%` }} />
          <span className="bg-fail" style={{ width: `${(counts.fail / t) * 100}%` }} />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "pass" | "fail" }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="truncate text-[12px] text-muted">{label}</div>
      <div
        className={`mt-0.5 text-[20px] font-semibold tabular-nums tracking-[-0.02em] ${
          tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : "text-fg"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryStrip({ s }: { s: UserStatsSummary }) {
  return (
    <section aria-label="Testing summary" className="mt-8 overflow-hidden rounded-[8px] border border-line">
      <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
        <Kpi label="Projects" value={s.projectCount} />
        <Kpi label="Plans" value={s.planCount} />
        <Kpi label="Cases" value={s.caseCount} />
        <Kpi label="Runs" value={s.runCount} />
        <Kpi label="Pass rate" value={s.counts.total ? pct(s.passRate) : "—"} tone={s.counts.pass ? "pass" : undefined} />
        <Kpi label="Failure rate" value={s.counts.total ? pct(s.failRate) : "—"} tone={s.counts.fail ? "fail" : undefined} />
        <Kpi label="Not run" value={s.counts.total ? pct(s.notRunRate) : "—"} />
      </div>
      <div className="border-t border-line bg-surface px-4 py-2.5">
        <StackBar counts={s.counts} />
      </div>
    </section>
  );
}

function RepoLabels({ p }: { p: ProjectListItem }) {
  const repos = p.repos ?? [];
  if (repos.length === 0) return <span className="font-sans">—</span>;
  const title = repos.map((r) => `${r.label}: ${r.path}`).join("\n");
  if (repos.length === 1) {
    return (
      <span title={title}>
        {repos[0].label !== "main" ? `${repos[0].label} · ` : ""}
        {repos[0].path}
      </span>
    );
  }
  return <span title={title}>{repos.map((r) => r.label).join(" · ")}</span>;
}

const COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_56px_120px_88px]";

export function ProjectsView({
  projects,
  summary,
}: {
  projects: ProjectListItem[];
  summary: UserStatsSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const openNew = () => {
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const perProject = new Map(summary.perProject.map((x) => [x.projectId, x]));

  const newButton = (
    <button type="button" onClick={openNew} className={btnPrimary}>
      <Plus className="size-3.5" aria-hidden />
      New project
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Projects</h1>
        {projects.length > 0 && newButton}
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-[8px] border border-line px-6 py-20 text-center">
          <h2 className="text-[15px] font-medium">No projects yet</h2>
          <p className="mt-1.5 max-w-[380px] text-[13.5px] leading-relaxed text-muted">
            Create a project for each product you test. Your coding agent will add test plans to it.
          </p>
          <div className="mt-6">{newButton}</div>
        </div>
      ) : (
        <>
          <SummaryStrip s={summary} />
          <div className="mt-6 overflow-hidden rounded-[8px] border border-line">
            <div
              className={`hidden grid-cols-1 gap-6 border-b border-line bg-surface px-4 py-2 text-[12px] text-muted md:grid ${COLS}`}
            >
              <span>Name</span>
              <span>Repositories</span>
              <span className="text-right">Plans</span>
              <span>Results</span>
              <span className="text-right">Updated</span>
            </div>
            <ul className="divide-y divide-line">
              {projects.map((p) => {
                const stat = perProject.get(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className={`grid gap-1 px-4 py-3.5 transition-colors hover:bg-surface md:items-center md:gap-6 ${COLS}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{p.name}</div>
                        {p.description && <div className="truncate text-[13px] text-muted">{p.description}</div>}
                      </div>
                      <div className="min-w-0 truncate font-mono text-[12px] text-subtle">
                        <RepoLabels p={p} />
                      </div>
                      <div className="text-[13px] tabular-nums text-muted md:text-right">
                        {p.planCount}
                        <span className="md:hidden" suppressHydrationWarning>
                          {" "}
                          {p.planCount === 1 ? "plan" : "plans"} · {relativeTime(p.updatedAt)}
                        </span>
                      </div>
                      <div className="md:pr-2">
                        {stat ? <StackBar counts={stat.counts} /> : <div className="h-1.5" />}
                      </div>
                      <div className="hidden text-right text-[13px] text-muted md:block" suppressHydrationWarning>
                        {relativeTime(p.updatedAt)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <ProjectFormModal
        key={formKey}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(p) => {
          setOpen(false);
          router.push(`/projects/${p.id}`);
        }}
      />
    </>
  );
}
