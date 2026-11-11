"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errMsg } from "./api";
import { ConnectAgentModal } from "./ConnectAgentModal";
import { ErrorBlock, LoadingBlock, NoPlans, NoProjects } from "./EmptyState";
import { NewProjectModal } from "./NewProjectModal";
import { PlanHeader } from "./PlanHeader";
import { SectionSidebar, sectionDomId } from "./SectionSidebar";
import { TestCaseCard } from "./TestCaseCard";
import { ToastProvider, useToast } from "./Toast";
import { TopBar } from "./TopBar";
import type {
  CaseWithResult,
  Counts,
  Filter,
  PlanFull,
  PlanListItem,
  Project,
  ResultStatus,
  RunSummary,
} from "./types";

type Result = CaseWithResult["result"];
type ParamPatch = { project?: number | null; plan?: number | null; run?: number | null };

const toId = (v: string | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export default function AppShell({ appDir }: { appDir: string }) {
  return (
    <ToastProvider>
      <Shell appDir={appDir} />
    </ToastProvider>
  );
}

function Shell({ appDir }: { appDir: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();

  const projectParam = toId(sp.get("project"));
  const planParam = toId(sp.get("plan"));
  const runParam = toId(sp.get("run"));

  /** Merge into the URL query: undefined = keep, null = remove. */
  const setParams = useCallback(
    (patch: ParamPatch) => {
      const p = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (v === null) p.delete(k);
        else p.set(k, String(v));
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // Refetch when the tab regains focus (agents may have created/updated plans meanwhile).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last < 3000) return;
      last = Date.now();
      setTick((t) => t + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ---------- Projects ----------
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<Project[]>("/api/projects")
      .then((ps) => {
        if (cancelled) return;
        setProjects(ps);
        setLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const projectId = projects
    ? projects.some((p) => p.id === projectParam)
      ? projectParam
      : (projects[0]?.id ?? null)
    : null;
  const project = projects?.find((p) => p.id === projectId) ?? null;

  useEffect(() => {
    if (projects && projectId !== projectParam) setParams({ project: projectId, plan: null, run: null });
  }, [projects, projectId, projectParam, setParams]);

  // ---------- Plans of project ----------
  const [plansState, setPlansState] = useState<{ projectId: number; items: PlanListItem[] } | null>(null);
  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    api<PlanListItem[]>(`/api/plans?projectId=${projectId}`)
      .then((items) => {
        if (!cancelled) setPlansState({ projectId, items });
      })
      .catch((e) => {
        if (!cancelled) toast(`Couldn't load plans: ${errMsg(e)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, tick, toast]);

  const planItems = useMemo(
    () =>
      plansState && plansState.projectId === projectId
        ? [...plansState.items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        : null,
    [plansState, projectId],
  );
  const planId = planItems
    ? planItems.some((p) => p.id === planParam)
      ? planParam
      : (planItems[0]?.id ?? null)
    : null;

  useEffect(() => {
    if (planItems && planId !== planParam) setParams({ plan: planId, run: null });
  }, [planItems, planId, planParam, setParams]);

  // ---------- Full plan ----------
  const [plan, setPlan] = useState<PlanFull | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const loadedKey = useRef("");
  useEffect(() => {
    if (planId == null) return;
    const key = `${planId}:${runParam ?? ""}:${tick}`;
    if (loadedKey.current === key) return;
    let cancelled = false;
    api<PlanFull>(`/api/plans/${planId}${runParam ? `?runId=${runParam}` : ""}`)
      .then((p) => {
        if (cancelled) return;
        loadedKey.current = `${p.id}:${p.activeRunId ?? ""}:${tick}`;
        setPlan(p);
        setPlanError(null);
        if (p.activeRunId !== runParam) setParams({ run: p.activeRunId });
      })
      .catch((e) => {
        if (!cancelled) setPlanError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
  }, [planId, runParam, tick, setParams]);

  const current = plan && plan.id === planId ? plan : null;
  const runId = current?.activeRunId ?? null;

  const counts: Counts = useMemo(() => {
    const c = { total: 0, pass: 0, fail: 0, notRun: 0 };
    for (const s of current?.sections ?? [])
      for (const k of s.cases) {
        c.total++;
        if (k.result.status === "pass") c.pass++;
        else if (k.result.status === "fail") c.fail++;
        else c.notRun++;
      }
    return c;
  }, [current]);

  // Plan list with live counts for the open plan.
  const plansForMenu = useMemo(
    () => planItems?.map((p) => (current && p.id === current.id ? { ...p, counts } : p)) ?? null,
    [planItems, current, counts],
  );

  // ---------- Mutations ----------
  const updateResult = useCallback((caseId: number, fn: (r: Result) => Result) => {
    setPlan((p) =>
      p
        ? {
            ...p,
            sections: p.sections.map((s) =>
              s.cases.some((c) => c.id === caseId)
                ? { ...s, cases: s.cases.map((c) => (c.id === caseId ? { ...c, result: fn(c.result) } : c)) }
                : s,
            ),
          }
        : p,
    );
  }, []);

  const findCase = (caseId: number) => current?.sections.flatMap((s) => s.cases).find((c) => c.id === caseId);

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

  const [busy, setBusy] = useState(false);

  const newRun = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const run = await api<RunSummary>("/api/runs", { method: "POST", body: { planId: current.id } });
      setParams({ run: run.id });
    } catch (e) {
      toast(`Couldn't create run: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearMarks = async () => {
    if (!current || runId == null) return;
    const runName = current.runs.find((r) => r.id === runId)?.name ?? "this run";
    if (!window.confirm(`Clear all Pass/Fail marks and notes in ${runName}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/runs/${runId}/reset`, { method: "POST" });
      setPlan((p) =>
        p
          ? {
              ...p,
              sections: p.sections.map((s) => ({
                ...s,
                cases: s.cases.map((c) => ({ ...c, result: { ...c.result, status: "not_run", notes: null } })),
              })),
            }
          : p,
      );
    } catch (e) {
      toast(`Couldn't clear marks: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  // ---------- UI state ----------
  const [filter, setFilter] = useState<Filter>("all");
  const [connectOpen, setConnectOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const onProjectCreated = (p: Project) => {
    setProjects((ps) => [...(ps ?? []), p]);
    setNewProjectOpen(false);
    setParams({ project: p.id, plan: null, run: null });
    toast(`Project “${p.name}” created`, "info");
  };

  const visible = (c: CaseWithResult) =>
    filter === "all" ? true : filter === "fail" ? c.result.status === "fail" : c.result.status === "not_run";

  // ---------- Render ----------
  let body: React.ReactNode;
  if (loadError && !projects) {
    body = <ErrorBlock message={loadError} onRetry={() => setTick((t) => t + 1)} />;
  } else if (!projects) {
    body = <LoadingBlock />;
  } else if (projects.length === 0) {
    body = <NoProjects onNewProject={() => setNewProjectOpen(true)} onConnect={() => setConnectOpen(true)} />;
  } else if (!planItems) {
    body = <LoadingBlock />;
  } else if (planItems.length === 0) {
    body = <NoPlans projectName={project?.name ?? "my project"} onConnect={() => setConnectOpen(true)} />;
  } else if (!current) {
    body = planError ? (
      <ErrorBlock message={planError} onRetry={() => setTick((t) => t + 1)} />
    ) : (
      <LoadingBlock />
    );
  } else {
    body = (
      <main>
        <PlanHeader
          plan={current}
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          onSelectRun={(id) => setParams({ run: id })}
          onNewRun={newRun}
          onClearMarks={clearMarks}
          busy={busy}
        />
        <div className="mx-auto flex max-w-[1240px] gap-10 px-4 pb-32 pt-8 sm:px-6">
          <SectionSidebar sections={current.sections} />
          <div className="min-w-0 flex-1 space-y-12">
            {current.sections.length === 0 && (
              <p className="rounded-[10px] border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-muted">
                This plan has no sections yet.
              </p>
            )}
            {current.sections.map((s) => {
              const cases = s.cases.filter(visible);
              return (
                <section
                  key={s.id}
                  id={sectionDomId(s.id)}
                  data-section-id={s.id}
                  aria-labelledby={`${sectionDomId(s.id)}-title`}
                  className="scroll-mt-[150px] max-sm:scroll-mt-[190px]"
                >
                  <div className="mb-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[15px] font-semibold text-accent">{s.code}</span>
                      <h2
                        id={`${sectionDomId(s.id)}-title`}
                        className="text-[20px] font-semibold tracking-[-0.015em] text-fg"
                      >
                        {s.title}
                      </h2>
                    </div>
                    {s.description && (
                      <p className="mt-1.5 max-w-[72ch] text-[13.5px] leading-relaxed text-muted">
                        {s.description}
                      </p>
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
                      <p className="rounded-[10px] border border-dashed border-line px-4 py-4 font-mono text-[12px] text-muted">
                        {s.cases.length === 0
                          ? "No cases in this section."
                          : filter === "fail"
                            ? `No failed cases in ${s.code}.`
                            : `Every case in ${s.code} has been run.`}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar
        projects={projects}
        projectId={projectId}
        onSelectProject={(id) => setParams({ project: id, plan: null, run: null })}
        plans={plansForMenu}
        planId={planId}
        onSelectPlan={(id) => setParams({ plan: id, run: null })}
        onNewProject={() => setNewProjectOpen(true)}
        onConnect={() => setConnectOpen(true)}
        refreshKey={tick}
      />
      {body}
      <ConnectAgentModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        appDir={appDir}
        projectName={project?.name}
      />
      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} onCreated={onProjectCreated} />
    </div>
  );
}
