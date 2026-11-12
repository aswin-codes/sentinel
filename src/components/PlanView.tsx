"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errMsg } from "./api";
import { Menu } from "./Menu";
import { ConfirmModal } from "./Modal";
import { ProgressBar } from "./Progress";
import { RunPicker, type RunDeleteResult } from "./RunPicker";
import { SectionSidebar, sectionDomId } from "./SectionSidebar";
import { Spinner } from "./Spinner";
import { TestCaseCard, type NotesState } from "./TestCaseCard";
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  const [notesState, setNotesState] = useState<Record<number, NotesState>>({});
  // Per-case bookkeeping so rapid toggles can't race: latest click wins, stale responses are ignored.
  const seqRef = useRef(new Map<number, number>());
  const confirmedRef = useRef(new Map<number, ResultStatus>());
  const chainRef = useRef(new Map<number, Promise<void>>());
  const notesSeqRef = useRef(new Map<number, number>());
  const pendingRef = useRef(0);
  const runId = plan.activeRunId;
  const planHref = `/projects/${plan.projectId}/plans/${plan.id}`;

  /** Load a run (or the latest) and reflect it in ?run= without a server round-trip. */
  const loadRun = useCallback(
    async (id: number | null) => {
      try {
        const p = await api<PlanFull>(`/api/plans/${plan.id}${id ? `?runId=${id}` : ""}`);
        seqRef.current.clear();
        confirmedRef.current.clear();
        chainRef.current.clear();
        notesSeqRef.current.clear();
        setNotesState({});
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
      if (Date.now() - last < 5000 || pendingRef.current > 0) return;
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

  const setStatus = (caseId: number, status: ResultStatus) => {
    const c = findCase(caseId);
    if (!c || runId == null) return;
    const run = runId;
    const seqs = seqRef.current;
    if (!confirmedRef.current.has(caseId)) confirmedRef.current.set(caseId, c.result.status);
    const seq = (seqs.get(caseId) ?? 0) + 1;
    seqs.set(caseId, seq);
    updateResult(caseId, (r) => ({ ...r, status }));
    pendingRef.current++;
    const prior = chainRef.current.get(caseId) ?? Promise.resolve();
    const next = prior.then(async () => {
      try {
        if (seqs.get(caseId) !== seq) return; // superseded by a newer click; that one sends the final state
        try {
          await api("/api/results", { method: "PATCH", body: { runId: run, caseId, status } });
          if (seqs.get(caseId) === seq) confirmedRef.current.set(caseId, status);
        } catch (e) {
          if (seqs.get(caseId) !== seq || runRef.current !== run) return;
          updateResult(caseId, (r) => ({ ...r, status: confirmedRef.current.get(caseId) ?? r.status }));
          toast(`Couldn't save ${c.code}: ${errMsg(e)}`);
        }
      } finally {
        pendingRef.current--;
      }
    });
    chainRef.current.set(caseId, next);
  };

  const clearNotesState = (caseId: number) =>
    setNotesState((m) => {
      const rest = { ...m };
      delete rest[caseId];
      return rest;
    });

  const saveNotes = async (caseId: number, notes: string | null) => {
    const c = findCase(caseId);
    if (!c || runId == null) return;
    const run = runId;
    const prev = c.result.notes;
    const seq = (notesSeqRef.current.get(caseId) ?? 0) + 1;
    notesSeqRef.current.set(caseId, seq);
    updateResult(caseId, (r) => ({ ...r, notes }));
    setNotesState((m) => ({ ...m, [caseId]: "saving" }));
    pendingRef.current++;
    try {
      await api("/api/results", { method: "PATCH", body: { runId: run, caseId, notes } });
      if (notesSeqRef.current.get(caseId) !== seq) return;
      setNotesState((m) => ({ ...m, [caseId]: "saved" }));
      window.setTimeout(() => {
        if (notesSeqRef.current.get(caseId) === seq) clearNotesState(caseId);
      }, 1600);
    } catch (e) {
      if (notesSeqRef.current.get(caseId) !== seq || runRef.current !== run) return;
      updateResult(caseId, (r) => ({ ...r, notes: prev }));
      clearNotesState(caseId);
      toast(`Couldn't save notes for ${c.code}: ${errMsg(e)}`);
    } finally {
      pendingRef.current--;
    }
  };

  const switchRun = async (id: number) => {
    setLoadingRun(true);
    try {
      await loadRun(id);
    } finally {
      setLoadingRun(false);
    }
  };

  const onRunDeleted = (res: RunDeleteResult) => {
    toast(res.recreated ? "Run deleted — started a fresh run" : "Run deleted", "info");
    if (res.deletedRunId === runId || res.recreated) {
      router.replace(`${planHref}?run=${res.nextRunId}`);
    } else {
      setPlan((p) => ({ ...p, runs: p.runs.filter((r) => r.id !== res.deletedRunId) }));
    }
    router.refresh();
  };

  const deletePlan = async () => {
    await api(`/api/plans/${plan.id}`, { method: "DELETE" });
    router.push(`/projects/${plan.projectId}`);
    router.refresh();
  };

  const newRun = async () => {
    setBusy(true);
    try {
      const run = await api<RunSummary>("/api/runs", { method: "POST", body: { planId: plan.id } });
      await loadRun(run.id);
      router.refresh();
    } catch (e) {
      toast(`Couldn't create run: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearMarks = async () => {
    if (runId == null) return;
    await api(`/api/runs/${runId}/reset`, { method: "POST" });
    seqRef.current.clear();
    confirmedRef.current.clear();
    setNotesState({});
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
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-[24px] font-semibold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere]">
            {plan.title}
          </h1>
          <Menu
            ariaLabel="Plan actions"
            trigger={<MoreHorizontal aria-hidden className="size-4" />}
            triggerClassName="inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-surface hover:text-fg"
            items={[{ key: "delete", label: "Delete plan…", danger: true, onSelect: () => setDeletePlanOpen(true) }]}
          />
        </div>
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
        {plan.repoLabels.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Repositories covered">
            {plan.repoLabels.map((l) => (
              <span
                key={l}
                className="inline-flex h-5 items-center rounded-[4px] border border-line px-1.5 text-[11px] text-muted"
              >
                {l}
              </span>
            ))}
          </div>
        )}
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
            <RunPicker
              runs={plan.runs}
              activeRunId={runId}
              loading={loadingRun}
              disabled={busy}
              onSelect={(id) => void switchRun(id)}
              onDeleted={onRunDeleted}
            />
            <button type="button" onClick={newRun} disabled={busy || loadingRun} className={`${btnGhost} h-7 px-2`}>
              {busy && <Spinner />}
              New run
            </button>
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              disabled={busy || loadingRun || done === 0}
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
                      notesState={notesState[c.id]}
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
        pendingLabel="Clearing…"
        danger
        onConfirm={clearMarks}
      />
      <ConfirmModal
        open={deletePlanOpen}
        onClose={() => setDeletePlanOpen(false)}
        title="Delete plan?"
        description={`Delete "${plan.title}" with all its cases and runs? This can't be undone.`}
        confirmLabel="Delete plan"
        pendingLabel="Deleting…"
        danger
        onConfirm={deletePlan}
      />
    </>
  );
}
