"use client";

import { GitBranch, Plus, RotateCcw } from "lucide-react";
import { Dropdown } from "./Dropdown";
import { RichText } from "./InlineCode";
import { Tag } from "./Tag";
import type { Counts, Filter, PlanFull } from "./types";
import { btnSecondary } from "./ui";

/** Known tag meanings for the legend; matched case-insensitively on the label. */
const TAG_HINTS: { match: RegExp; hint: string }[] = [
  { match: /admin/i, hint: "where you test" },
  { match: /claude|agent/i, hint: "ask Claude to seed data or fire a webhook first" },
];

function eyebrow(plan: PlanFull) {
  const topic = plan.title.replace(/\s*(?:[-–—:]\s*)?(?:qa\s+)?(?:test\s+)?plan$/i, "").trim() || plan.title;
  return `${plan.projectName} · ${topic}`;
}

function formatRunDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PlanHeader({
  plan,
  counts,
  filter,
  onFilter,
  onSelectRun,
  onNewRun,
  onClearMarks,
  busy,
}: {
  plan: PlanFull;
  counts: Counts;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onSelectRun: (runId: number) => void;
  onNewRun: () => void;
  onClearMarks: () => void;
  busy: boolean;
}) {
  // Legend: unique tags present in the plan, in first-seen order.
  const legend = new Map<string, { label: string; color: string }>();
  for (const s of plan.sections)
    for (const c of s.cases)
      for (const t of c.tags) if (!legend.has(t.label.toLowerCase())) legend.set(t.label.toLowerCase(), t);

  const run = plan.runs.find((r) => r.id === plan.activeRunId);
  const done = counts.pass + counts.fail;
  const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.total },
    { id: "not_run", label: "Not run", n: counts.notRun },
    { id: "fail", label: "Failed", n: counts.fail },
  ];

  return (
    <>
      <header className="mx-auto max-w-[1240px] px-4 pb-7 pt-10 sm:px-6 sm:pt-12">
        <div className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-accent">
          {eyebrow(plan)}
        </div>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[34px]">
          {plan.title}
        </h1>
        {plan.description && (
          <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-muted">
            <RichText text={plan.description} />
          </p>
        )}
        {(plan.gitBranch || plan.commitHash) && (
          <div className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11.5px] text-muted">
            <GitBranch className="size-3" aria-hidden />
            {plan.gitBranch}
            {plan.commitHash && <span className="text-muted/70">@ {plan.commitHash.slice(0, 7)}</span>}
          </div>
        )}
        {legend.size > 0 && (
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Tag legend">
            {[...legend.values()].map((t) => {
              const hint = TAG_HINTS.find((h) => h.match.test(t.label))?.hint;
              return (
                <li key={t.label} className="flex items-center gap-2 text-[12.5px] text-muted">
                  <Tag label={t.label} color={t.color} />
                  {hint && <span>— {hint}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </header>

      <div className="sticky top-[52px] z-30 border-y border-line bg-canvas/95 backdrop-blur-sm supports-[backdrop-filter]:bg-canvas/85">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="whitespace-nowrap font-mono text-[12.5px] tabular-nums" aria-live="polite">
              <span className="text-fg">{done}</span>
              <span className="text-muted">/{counts.total} run</span>
              <span className="mx-1.5 text-line-strong">·</span>
              <span className="text-pass">{counts.pass} pass</span>
              <span className="mx-1.5 text-line-strong">·</span>
              <span className={counts.fail ? "text-fail" : "text-muted"}>{counts.fail} fail</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progress"
              aria-valuemin={0}
              aria-valuemax={counts.total}
              aria-valuenow={done}
              className="flex h-1.5 w-24 overflow-hidden rounded-full bg-line sm:w-40"
            >
              <div className="h-full bg-pass transition-[width] duration-300" style={{ width: `${pct(counts.pass)}%` }} />
              <div className="h-full bg-fail transition-[width] duration-300" style={{ width: `${pct(counts.fail)}%` }} />
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filter cases" className="inline-flex rounded-[6px] border border-line bg-surface p-0.5">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => onFilter(f.id)}
                  className={`inline-flex h-[26px] items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors ${
                    filter === f.id ? "bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted hover:text-fg"
                  }`}
                >
                  {f.label}
                  <span className="font-mono text-[11px] text-muted tabular-nums">{f.n}</span>
                </button>
              ))}
            </div>

            <Dropdown
              ariaLabel="Select run"
              align="right"
              triggerClassName="border border-line bg-surface hover:border-line-strong"
              trigger={<span className="font-mono text-[12px]">{run?.name ?? "Run"}</span>}
              items={[
                ...plan.runs.map((r) => ({
                  key: String(r.id),
                  label: r.name,
                  meta: formatRunDate(r.createdAt),
                  selected: r.id === plan.activeRunId,
                  onSelect: () => onSelectRun(r.id),
                })),
                {
                  key: "new",
                  label: "New run",
                  icon: <Plus className="size-3.5" />,
                  dividerBefore: plan.runs.length > 0,
                  onSelect: onNewRun,
                },
              ]}
            />

            <button
              type="button"
              onClick={onClearMarks}
              disabled={busy || done === 0}
              className={`${btnSecondary} px-2.5`}
              title="Reset every case in this run to Not run"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Clear marks</span>
              <span className="sr-only sm:hidden">Clear marks</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
