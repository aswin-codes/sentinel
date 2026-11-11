"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errMsg } from "./api";
import { ConfirmModal } from "./Modal";
import { ProgressBar } from "./Progress";
import { SectionSidebar, sectionDomId } from "./SectionSidebar";
import { TestCaseCard } from "./TestCaseCard";
import { relativeTime } from "./time";
import { useToast } from "./Toast";
import type { CaseWithResult, Counts, Filter, PlanFull, ResultStatus, RunSummary } from "./types";
import { btnGhost } from "./ui";

type Result = CaseWithResult["result"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_run", label: "Not run" },
  { id: "fail", label: "Failed" },
];

export function PlanView({ initialPlan }: { initialPlan: PlanFull }) {
  const toast = useToast();
  const [plan, setPlan] = useState(initialPlan);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const runId = plan.activeRunId;
  const planHref = `/projects/${plan.projectId}/plans/${plan.id}`;

  /** Load a run (or the latest) and reflect it in ?run= without a server round-trip. */
  const loadRun = useCallback(
    async (id: number | null) => {
      try {
        const p = await api<PlanFull>(`/api/plans/${plan.id}${id ? `?runId=${id}` : ""}`);
        setPlan(p);
        if (p.activeRunId) window.history.replaceState(null, "", `${planHref}?run=${p.activeRunId}`);
      } catch (e) {
        toast(`Couldn't load run: ${errMsg(e)}`);
      }
    },
    [plan.id, planHref, toast],
  );

  // Agents may update the plan meanwhile: refetch the current run when the tab regains focus.
  const runRef = useRef(runId);
  useEffect(() => {
    runRef.current = runId;
  });
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last < 5000) return;
      last = Date.now();
      void loadRun(runRef.current);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadRun]);

  const counts: Counts = useMemo(() => {
    const c = { total: 0, pass: 0, fail: 0, notRun: 0 };
    for (const s of plan.sections)
      for (const k of s.cases) {
        c.total++;
        if (k.result.status === "pass") c.pass++;
        else if (k.result.status === "fail") c.fail++;
        else c.notRun++;
      }
    return c;
  }, [plan]);

  // ---------- Mutations (optimistic, rollback on error) ----------
  const updateResult = useCallback((caseId: number, fn: (r: Result) => Result) => {
    setPlan((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.cases.some((c) => c.id === caseId)
          ? { ...s, cases: s.cases.map((c) => (c.id === caseId ? { ...c, result: fn(c.result) } : c)) }
          : s,
      ),
    }));
  }, []);

  const findCase = (caseId: number) => plan.sections.flatMap((s) => s.cases).find((c) => c.id === caseId);

  const setStatus = async (caseId: number, status: ResultStatus) => {
    const c = findCase(caseId);
    if (!c || runId == null) return;
    const prev = c.result.status;
    updateResult(caseId, (r) => ({ ...r, status }));
    try {
      await api("/api/results", { method: "PATCH", body: { runId, caseId, status } });
    } catch (e) {
      updateResult(caseId, (r) => ({ ...r, status: prev }));
      toast(`Couldn't save ${c.code}: ${errMsg(e)}`);
    }
  };

  const saveNotes = async (caseId: number, notes: string | null) => {
    const c = findCase(caseId);
    if (!c || runId == null) return;
    const prev = c.result.notes;
    updateResult(caseId, (r) => ({ ...r, notes }));
    try {
      await api("/api/results", { method: "PATCH", body: { runId, caseId, notes } });
    } catch (e) {
      updateResult(caseId, (r) => ({ ...r, notes: prev }));
      toast(`Couldn't save notes for ${c.code}: ${errMsg(e)}`);
    }
  };

  const newRun = async () => {
    setBusy(true);
    try {
      const run = await api<RunSummary>("/api/runs", { method: "POST", body: { planId: plan.id } });
      await loadRun(run.id);
    } catch (e) {
      toast(`Couldn't create run: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearMarks = async () => {
    if (runId == null) return;
    await api(`/api/runs/${runId}/reset`, { method: "POST" });
    setPlan((p) => ({
      ...p,
      sections: p.sections.map((s) => ({
        ...s,
        cases: s.cases.map((c) => ({ ...c, result: { ...c.result, status: "not_run", notes: null } })),
      })),
    }));
    setClearOpen(false);
  };

  const visible = (c: CaseWithResult) =>
    filter === "all" ? true : filter === "fail" ? c.result.status === "fail" : c.result.status === "not_run";

  const done = counts.pass + counts.fail;
  const runName = plan.runs.find((r) => r.id === runId)?.name ?? "this run";

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-[13px] text-muted">
        <Link href="/projects" className="shrink-0 hover:text-fg">
          Projects
        </Link>
        <span className="mx-1.5 text-subtle">/</span>
        <Link href={`/projects/${plan.projectId}`} className="min-w-0 truncate hover:text-fg">
          {plan.projectName}
        </Link>
        <span className="mx-1.5 text-subtle">/</span>
        <span className="min-w-0 truncate text-fg">{plan.title}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere]">
          {plan.title}
        </h1>
        {plan.description && (
          <p className="mt-2 max-w-[720px] text-[14px] leading-relaxed text-muted">{plan.description}</p>
        )}
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-subtle">
          {plan.gitBranch && (
            <>
              <span className="font-mono text-muted">
                {plan.gitBranch}
                {plan.commitHash && <span className="text-subtle"> @ {plan.commitHash.slice(0, 7)}</span>}
              </span>
              <span>·</span>
            </>
          )}
          <span className="capitalize">{plan.status}</span>
          <span>·</span>
          <span suppressHydrationWarning>Updated {relativeTime(plan.updatedAt)}</span>
        </p>
      </header>

      {/* Toolbar */}
      <div className="z-30 -mx-4 mt-6 border-y border-line bg-bg/95 px-4 py-2.5 backdrop-blur-sm sm:sticky sm:top-14 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] tabular-nums">
              <span className="font-medium">
                {done}/{counts.total}
              </span>
              <span className="text-muted"> run</span>
              <span className="text-subtle"> · </span>
              <span className={counts.pass ? "text-pass" : "text-muted"}>{counts.pass} pass</span>
              <span className="text-subtle"> · </span>
              <span className={counts.fail ? "text-fail" : "text-muted"}>{counts.fail} fail</span>
            </span>
            <ProgressBar counts={counts} className="w-20" />
          </div>

          <div role="tablist" aria-label="Filter cases" className="flex items-center gap-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`h-7 rounded-[6px] px-2.5 text-[13px] transition-colors ${
                  filter === f.id ? "bg-surface text-fg ring-1 ring-line ring-inset" : "text-muted hover:text-fg"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:ml-auto">
            <label className="sr-only" htmlFor="run-select">
              Run
            </label>
            <select
              id="run-select"
              value={runId ?? ""}
              onChange={(e) => void loadRun(Number(e.target.value))}
              className="h-7 max-w-[180px] rounded-[6px] border border-line bg-bg pl-2 pr-1 text-[13px] text-fg focus:border-fg/40 focus:outline-none"
            >
              {plan.runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={newRun} disabled={busy} className={`${btnGhost} h-7 px-2`}>
              New run
            </button>
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              disabled={busy || done === 0}
              className={`${btnGhost} h-7 px-2`}
            >
              Clear marks
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-12">
        {plan.sections.length > 0 && <SectionSidebar sections={plan.sections} />}
        <div className="min-w-0 flex-1 space-y-12">
          {plan.sections.length === 0 && (
            <p className="rounded-[8px] border border-line px-4 py-10 text-center text-[13.5px] text-muted">
              This plan has no test cases yet.
            </p>
          )}
          {plan.sections.map((s) => {
            const cases = s.cases.filter(visible);
            return (
              <section
                key={s.id}
                id={sectionDomId(s.id)}
                data-section-id={s.id}
                aria-labelledby={`${sectionDomId(s.id)}-title`}
                className="scroll-mt-[140px]"
              >
                <div className="mb-4">
                  <h2 id={`${sectionDomId(s.id)}-title`} className="flex items-baseline gap-2.5 text-[16px] font-semibold">
                    <span className="font-mono text-[12.5px] font-normal text-subtle">{s.code}</span>
                    {s.title}
                  </h2>
                  {s.description && (
                    <p className="mt-1 max-w-[72ch] text-[13.5px] leading-relaxed text-muted">{s.description}</p>
                  )}
                </div>
                <div className="space-y-3">
                  {cases.map((c) => (
                    <TestCaseCard
                      key={`${runId}:${c.id}`}
                      c={c}
                      onStatus={(st) => setStatus(c.id, st)}
                      onSaveNotes={(n) => saveNotes(c.id, n)}
                    />
                  ))}
                  {cases.length === 0 && (
                    <p className="rounded-[8px] border border-dashed border-line px-4 py-3.5 text-[13px] text-subtle">
                      {s.cases.length === 0
                        ? "No cases in this section."
                        : filter === "fail"
                          ? "No failed cases in this section."
                          : "Every case in this section has been run."}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear all marks?"
        description={`Every Pass/Fail mark and note in ${runName} will be removed. This can't be undone.`}
        confirmLabel="Clear marks"
        danger
        onConfirm={clearMarks}
      />
    </>
  );
}
