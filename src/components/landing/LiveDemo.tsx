"use client";

import { ArrowRight, ChevronRight, MousePointerClick, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { RichText } from "../InlineCode";
import { ProgressBar } from "../Progress";
import { btnGhost, btnSecondary, smallLabel } from "../ui";
import { CASES, PLAN_BRANCH, PLAN_COMMIT, PLAN_TITLE, SECTIONS, type DemoCase } from "./demoData";

/* ------------------------------------------------------------------ timeline */

const TICK_MS = 50;
const TYPE_MS = 28;

type LineKind = "prompt" | "tool" | "out" | "text" | "edit" | "ok" | "failcase" | "note";
type Line = { at: number; kind: LineKind; text: string; code?: string };

const PROMPT_1 = "Inspect my recent changes and create a QA test plan in QA Hub";
const PROMPT_3 = "Fix the failed QA checks";

const STEP1_LINES: Line[] = [
  { at: 300, kind: "prompt", text: PROMPT_1 },
  { at: 2500, kind: "tool", text: "inspect_repo_changes" },
  { at: 3200, kind: "out", text: `${PLAN_BRANCH} · 6 files, +214 −38` },
  { at: 4000, kind: "text", text: "New applyCoupon() and a coupon field on /checkout. Writing a plan for the flow." },
  { at: 5000, kind: "tool", text: "upsert_test_plan" },
  { at: 7900, kind: "out", text: `Created "${PLAN_TITLE}" · 2 sections · 5 cases` },
  { at: 8600, kind: "text", text: "The plan is in QA Hub. Run through it and mark anything that fails." },
];
const STEP1_END = 11000;
/** When the plan header and each section/case row appears in step 1. */
const PLAN_HEADER_AT = 5300;
const ROW_AT = (i: number) => 5600 + i * 330;

const AUTO_MARKS: [number, string, "pass" | "fail"][] = [
  [1800, "S1", "pass"],
  [2600, "C1", "pass"],
  [3400, "C2", "pass"],
  [4400, "C3", "fail"],
  [5400, "C4", "pass"],
];
const STEP2_END = 8500;

function step3Timeline(failed: FailedCase[]) {
  const lines: Line[] = [{ at: 300, kind: "prompt", text: PROMPT_3 }];
  let t = 300 + PROMPT_3.length * TYPE_MS + 700;
  lines.push({ at: t, kind: "tool", text: "get_failed_test_cases" });
  t += 700;
  if (failed.length === 0) {
    lines.push({ at: t, kind: "out", text: `0 failed · all ${CASES.length} cases passed in Run 1` });
    lines.push({ at: t + 700, kind: "text", text: "Nothing to fix. Every check passed." });
    return { lines, run2At: Infinity, end: t + 3500 };
  }
  lines.push({ at: t, kind: "out", text: `${failed.length} failed · "${PLAN_TITLE}" · Run 1` });
  t += 450;
  for (const c of failed) {
    lines.push({ at: t, kind: "failcase", text: c.title, code: c.code });
    lines.push({ at: t + 150, kind: "note", text: c.notes });
    t += 500;
  }
  t += 500;
  for (const c of failed) {
    lines.push({ at: t, kind: "edit", text: c.fix.file });
    lines.push({ at: t + 850, kind: "ok", text: c.fix.result });
    t += 1500;
  }
  const n = failed.length;
  lines.push({ at: t, kind: "text", text: `Fixed ${n} failed case${n === 1 ? "" : "s"}. Ready for re-test.` });
  const run2At = t + 900;
  return { lines, run2At, end: run2At + 4000 };
}

/* --------------------------------------------------------------------- state */

type Step = 0 | 1 | 2;
type Result = { status: "pass" | "fail"; notes: string };
type FailedCase = DemoCase & { notes: string };

type State = {
  step: Step;
  t: number;
  playing: boolean;
  started: boolean;
  results: Record<string, Result>;
  touched: boolean;
  open: string | null;
  failed: FailedCase[];
};

type Action =
  | { type: "tick" }
  | { type: "visible" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "replay" }
  | { type: "goto"; step: Step; play?: boolean }
  | { type: "mark"; code: string; status: "pass" | "fail" }
  | { type: "note"; code: string; notes: string }
  | { type: "toggle"; code: string };

const INITIAL: State = {
  step: 0,
  t: 0,
  playing: false,
  started: false,
  results: {},
  touched: false,
  open: "C1",
  failed: [],
};

const byCode = (code: string) => CASES.find((c) => c.code === code)!;

function duration(s: State): number {
  if (s.step === 0) return STEP1_END;
  if (s.step === 1) return STEP2_END;
  return step3Timeline(s.failed).end;
}

function enter(s: State, step: Step, playing: boolean): State {
  let next: State = { ...s, step, playing, t: 0 };
  if (step === 2) {
    // Jumped straight to "fix" without testing anything: use the scripted run.
    let results = s.results;
    if (Object.keys(results).length === 0) {
      results = {};
      for (const [, code, status] of AUTO_MARKS) results[code] = { status, notes: status === "fail" ? byCode(code).failNote : "" };
    }
    const failed = CASES.filter((c) => results[c.code]?.status === "fail").map((c) => ({
      ...c,
      notes: results[c.code].notes.trim() || "(no notes)",
    }));
    next = { ...next, results, failed };
  }
  // Paused on a terminal step: show it complete instead of empty.
  if (!playing && step !== 1) next.t = duration(next);
  return next;
}

function setResult(s: State, code: string, status: "pass" | "fail" | null): State {
  const results = { ...s.results };
  if (status === null) delete results[code];
  else results[code] = { status, notes: status === "fail" ? s.results[code]?.notes || byCode(code).failNote : "" };
  return { ...s, results, open: status === "fail" ? code : s.open };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "tick": {
      if (!s.playing) return s;
      const t = s.t + TICK_MS;
      let next: State = { ...s, t };
      if (s.step === 1 && !s.touched) {
        for (const [at, code, status] of AUTO_MARKS) {
          if (at > s.t && at <= t && !next.results[code]) next = setResult(next, code, status);
        }
      }
      if (t >= duration(next)) {
        if (s.step < 2) return enter(next, (s.step + 1) as Step, true);
        return { ...next, t: duration(next), playing: false };
      }
      return next;
    }
    case "visible":
      return s.started ? s : { ...s, started: true, playing: true };
    case "play": {
      if (s.step === 2 && s.t >= duration(s)) return { ...INITIAL, started: true, playing: true };
      const t = s.step === 1 && s.touched ? Math.max(s.t, STEP2_END - 2000) : s.t;
      return { ...s, t, playing: true, started: true };
    }
    case "pause":
      return { ...s, playing: false, started: true };
    case "replay":
      return { ...INITIAL, started: true, playing: true };
    case "goto":
      return enter({ ...s, started: true }, a.step, a.play ?? s.playing);
    case "mark": {
      const base = s.step === 1 ? s : enter(s, 1, false);
      const current = base.results[a.code]?.status;
      const next = setResult(base, a.code, current === a.status ? null : a.status);
      return { ...next, touched: true, playing: false, started: true };
    }
    case "note": {
      const r = s.results[a.code];
      if (!r) return s;
      return { ...s, results: { ...s.results, [a.code]: { ...r, notes: a.notes } }, touched: true, playing: false };
    }
    case "toggle":
      return { ...s, open: s.open === a.code ? null : a.code };
  }
}

/* --------------------------------------------------------------- media hook */

const RM_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeRM,
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}

/* ---------------------------------------------------------------- component */

const STEPS: { label: string; short: string; caption: string }[] = [
  {
    label: "Agent writes the plan",
    short: "Plan",
    caption: "Your agent reads the git diff over MCP and writes a structured test plan into your project.",
  },
  {
    label: "You test it",
    short: "Test",
    caption: "Run each case and mark it Pass or Fail. Failures get a note in your own words.",
  },
  {
    label: "Agent fixes failures",
    short: "Fix",
    caption: "The agent pulls the failures and your notes back over MCP, fixes the code, and you re-test.",
  },
];

export function LiveDemo() {
  const reduced = useReducedMotion();
  const [s, dispatch] = useReducer(reducer, INITIAL);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useRef(false);

  // Start autoplay the first time the demo scrolls into view; only tick while visible.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting;
        if (entry.isIntersecting && !window.matchMedia(RM_QUERY).matches) dispatch({ type: "visible" });
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!s.playing) return;
    const id = window.setInterval(() => {
      if (inView.current && !document.hidden) dispatch({ type: "tick" });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [s.playing]);

  // What the visitor sees: everything at once when motion is reduced.
  const shown = reduced ? Infinity : s.t;
  const dur = duration(s);
  const progress = reduced && !s.playing ? 1 : Math.min(1, s.t / dur);
  const ended = s.step === 2 && s.t >= dur;

  const step3 = s.step === 2 ? step3Timeline(s.failed) : null;
  const lines = s.step === 2 ? step3!.lines : STEP1_LINES;
  const termTime = s.step === 1 ? Infinity : shown;
  const run = step3 && shown >= step3.run2At ? 2 : 1;

  return (
    <div ref={rootRef} className="overflow-hidden rounded-[8px] border border-line bg-bg">
      {/* step tabs */}
      <div role="tablist" aria-label="Demo steps" className="grid grid-cols-3 border-b border-line">
        {STEPS.map((st, i) => {
          const active = s.step === i;
          return (
            <button
              key={st.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => dispatch({ type: "goto", step: i as Step })}
              className={`relative flex h-11 items-center justify-center gap-2 px-2 text-[13px] transition-colors sm:justify-start sm:px-4 ${
                i > 0 ? "border-l border-line" : ""
              } ${active ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${
                  active ? "border-fg bg-fg text-bg" : "border-line text-subtle"
                }`}
              >
                {i + 1}
              </span>
              <span className="truncate font-medium">
                <span className="sm:hidden">{st.short}</span>
                <span className="hidden sm:inline">{st.label}</span>
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[-1px] h-px origin-left bg-fg"
                  style={{ transform: `scaleX(${progress})` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* panels */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Terminal lines={lines} time={termTime} idle={s.step === 1} />
        <PlanPanel
          s={s}
          shown={shown}
          run={run}
          onMark={(code, status) => dispatch({ type: "mark", code, status })}
          onNote={(code, notes) => dispatch({ type: "note", code, notes })}
          onToggle={(code) => dispatch({ type: "toggle", code })}
        />
      </div>

      {/* caption + controls */}
      <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="min-h-[40px] text-[13px] leading-[20px] text-muted sm:min-h-0" aria-live="polite">
          {STEPS[s.step].caption}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {s.step === 1 && s.touched && (
            <button
              type="button"
              onClick={() => dispatch({ type: "goto", step: 2, play: true })}
              className={btnSecondary}
            >
              Hand failures to the agent
              <ArrowRight className="size-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: s.playing ? "pause" : "play" })}
            className={btnGhost}
            aria-label={s.playing ? "Pause demo" : "Play demo"}
          >
            {s.playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {s.playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "replay" })}
            className={btnGhost}
            aria-label="Replay demo from the start"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {ended ? "Replay" : <span className="sr-only sm:not-sr-only">Replay</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- terminal */

function Terminal({ lines, time, idle }: { lines: Line[]; time: number; idle: boolean }) {
  const visible = lines.filter((l) => l.at <= time);
  const prompt = visible[0];
  const typed = prompt ? Math.min(prompt.text.length, Math.floor((time - prompt.at) / TYPE_MS)) : 0;
  const typing = prompt && typed < prompt.text.length;
  const rest = typing ? [] : visible.slice(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rest.length, typed, idle]);

  return (
    <div className="flex h-[260px] flex-col border-b border-line bg-surface sm:h-[300px] lg:h-auto lg:border-b-0 lg:border-r">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-4 font-mono text-[11.5px] text-subtle">
        <span>claude · ~/shop</span>
        <span>mcp: qa-hub</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] [overflow-wrap:anywhere]"
          aria-label="Agent session"
        >
          {prompt && (
            <div className="flex gap-2 text-fg">
              <span className="text-subtle">&gt;</span>
              <span className="min-w-0">
                {prompt.text.slice(0, typed)}
                {typing && <Caret />}
              </span>
            </div>
          )}
          {rest.map((l, i) => (
            <TermLine key={`${l.at}-${i}`} line={l} />
          ))}
          {idle && (
            <div className="qh-in mt-3 flex gap-2">
              <span className="text-subtle">&gt;</span>
              <Caret />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Caret() {
  return <span aria-hidden className="qh-caret ml-px inline-block h-[14px] w-[7px] translate-y-[2px] bg-fg/60" />;
}

function TermLine({ line }: { line: Line }) {
  const base = "qh-in";
  switch (line.kind) {
    case "tool":
      return (
        <div className={`${base} mt-3 flex gap-2`}>
          <span className="text-fg">●</span>
          <span className="min-w-0">
            <span className="text-muted">qa-hub · </span>
            <span className="text-fg">{line.text}</span>
          </span>
        </div>
      );
    case "edit":
      return (
        <div className={`${base} mt-3 flex gap-2`}>
          <span className="text-fg">●</span>
          <span className="min-w-0">
            <span className="text-fg">Edit </span>
            <span className="text-muted">{line.text}</span>
          </span>
        </div>
      );
    case "out":
      return (
        <div className={`${base} flex gap-2 pl-1 text-muted`}>
          <span className="text-subtle">└</span>
          <span className="min-w-0">{line.text}</span>
        </div>
      );
    case "ok":
      return (
        <div className={`${base} flex gap-2 pl-1 text-muted`}>
          <span className="text-subtle">└</span>
          <span className="min-w-0">
            <span className="text-pass">✓</span> {line.text}
          </span>
        </div>
      );
    case "failcase":
      return (
        <div className={`${base} mt-1 flex gap-2 pl-5`}>
          <span className="text-fail">✕ {line.code}</span>
          <span className="min-w-0 text-fg">{line.text}</span>
        </div>
      );
    case "note":
      return <div className={`${base} pl-[3.25rem] text-muted`}>&ldquo;{line.text}&rdquo;</div>;
    case "text":
      return <div className={`${base} mt-3 font-sans text-[13px] leading-relaxed text-fg`}>{line.text}</div>;
    default:
      return null;
  }
}

/* --------------------------------------------------------------- plan panel */

function PlanPanel({
  s,
  shown,
  run,
  onMark,
  onNote,
  onToggle,
}: {
  s: State;
  shown: number;
  run: 1 | 2;
  onMark: (code: string, status: "pass" | "fail") => void;
  onNote: (code: string, notes: string) => void;
  onToggle: (code: string) => void;
}) {
  const building = s.step === 0;
  const headerVisible = !building || shown >= PLAN_HEADER_AT;
  const results: Record<string, Result> = building || run === 2 ? {} : s.results;
  const interactive = s.step === 1 || (building && shown >= ROW_AT(6));
  const fixedCodes = new Set(run === 2 ? s.failed.map((c) => c.code) : []);

  const vals = CASES.map((c) => results[c.code]?.status);
  const pass = vals.filter((v) => v === "pass").length;
  const fail = vals.filter((v) => v === "fail").length;
  const counts = { total: CASES.length, pass, fail, notRun: CASES.length - pass - fail };

  let row = 0;
  let note: React.ReactNode = null;
  if (s.step === 1 && !s.touched) {
    note = (
      <>
        <MousePointerClick className="size-3.5 shrink-0" aria-hidden />
        Try it — mark a case as failed.
      </>
    );
  } else if (s.step === 1) {
    note = "Your marks are saved to Run 1.";
  } else if (run === 2) {
    note = "Run 2 started · re-test the fixed cases.";
  } else if (building) {
    note = "Written by Claude Code over MCP · just now";
  } else {
    note = "Run 1 · handed back to the agent";
  }

  return (
    <div className="min-h-[600px] px-4 py-4 sm:min-h-[560px] sm:px-5 lg:min-h-[700px]">
      {!headerVisible ? (
        <div className="grid h-full min-h-[520px] place-items-center text-[13px] text-subtle">
          Waiting for the agent…
        </div>
      ) : (
        <div className={building ? "qh-in" : ""}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{PLAN_TITLE}</h3>
              <div className="mt-0.5 truncate font-mono text-[11.5px] text-subtle">
                {PLAN_BRANCH} · {PLAN_COMMIT}
              </div>
            </div>
            <span
              key={run}
              className="qh-in inline-flex h-6 shrink-0 items-center rounded-[6px] border border-line px-2 text-[12px] text-muted"
            >
              Run {run}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[12.5px] text-muted tabular-nums">
            <span>
              {counts.pass + counts.fail}/{counts.total} run · <span className={pass ? "text-pass" : ""}>{pass} pass</span>{" "}
              · <span className={fail ? "text-fail" : ""}>{fail} fail</span>
            </span>
          </div>
          <ProgressBar counts={counts} className="mt-2" />

          <div className="mt-3 flex h-5 items-center gap-1.5 text-[12.5px] text-muted">{note}</div>

          <div className="mt-3 space-y-5">
            {SECTIONS.map((sec) => {
              const secAt = ROW_AT(row++);
              if (building && shown < secAt) {
                row += sec.cases.length;
                return null;
              }
              return (
                <section key={sec.code} className={building ? "qh-in" : ""}>
                  <div className={`${smallLabel} mb-2`}>{sec.title}</div>
                  <div className="space-y-2">
                    {sec.cases.map((c) => {
                      const at = ROW_AT(row++);
                      if (building && shown < at) return null;
                      return (
                        <CaseRow
                          key={`${run}-${c.code}`}
                          c={c}
                          result={results[c.code]}
                          open={s.open === c.code}
                          interactive={interactive}
                          fixed={fixedCodes.has(c.code)}
                          animate={building || run === 2}
                          onMark={(st) => onMark(c.code, st)}
                          onNote={(n) => onNote(c.code, n)}
                          onToggle={() => onToggle(c.code)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CaseRow({
  c,
  result,
  open,
  interactive,
  fixed,
  animate,
  onMark,
  onNote,
  onToggle,
}: {
  c: DemoCase;
  result: Result | undefined;
  open: boolean;
  interactive: boolean;
  fixed: boolean;
  animate: boolean;
  onMark: (status: "pass" | "fail") => void;
  onNote: (notes: string) => void;
  onToggle: () => void;
}) {
  const status = result?.status;
  return (
    <article aria-label={`${c.code} ${c.title}`} className={`rounded-[8px] border border-line bg-bg ${animate ? "qh-in" : ""}`}>
      <div className="flex items-center gap-2 py-2 pl-2 pr-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[6px] px-1 py-1 text-left"
        >
          <ChevronRight
            aria-hidden
            className={`size-3.5 shrink-0 text-subtle transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="shrink-0 font-mono text-[12px] text-subtle">{c.code}</span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium leading-snug sm:truncate">{c.title}</span>
            {status === "fail" && !open && result?.notes && (
              <span className="block truncate text-[12px] text-subtle">{result.notes}</span>
            )}
            {fixed && <span className="block text-[12px] text-subtle">Fixed by agent · not run</span>}
          </span>
        </button>
        <div className="flex shrink-0 gap-1" role="group" aria-label={`Result for ${c.code}`}>
          <MarkButton kind="pass" pressed={status === "pass"} disabled={!interactive} onClick={() => onMark("pass")} />
          <MarkButton kind="fail" pressed={status === "fail"} disabled={!interactive} onClick={() => onMark("fail")} />
        </div>
      </div>

      {open && (
        <div className="border-t border-line px-3.5 pb-3.5 pt-3 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="min-w-0">
              <div className={`${smallLabel} mb-1.5`}>Steps</div>
              <ol className="space-y-1 text-[13px] leading-relaxed">
                {c.steps.map((st, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-3 shrink-0 text-right text-[12px] leading-[1.7] text-subtle tabular-nums">{i + 1}.</span>
                    <span className="min-w-0">
                      <RichText text={st} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0 self-start rounded-[6px] bg-surface px-3 py-2.5">
              <div className={`${smallLabel} mb-1.5`}>Expected</div>
              <ul className="space-y-1 text-[13px] leading-relaxed">
                {c.expected.map((st, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-subtle" />
                    <span className="min-w-0">
                      <RichText text={st} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {status === "fail" && (
            <div className="qh-in mt-3">
              <label htmlFor={`demo-notes-${c.code}`} className="mb-1 block text-[12px] text-muted">
                Failure notes
              </label>
              <textarea
                id={`demo-notes-${c.code}`}
                value={result?.notes ?? ""}
                onChange={(e) => onNote(e.target.value)}
                rows={2}
                className="block w-full resize-none rounded-[6px] border border-line bg-bg px-3 py-2 text-[13px] leading-relaxed placeholder:text-subtle focus:border-fg/40 focus:outline-none focus:ring-2 focus:ring-fg/10"
                placeholder="What went wrong?"
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MarkButton({
  kind,
  pressed,
  disabled,
  onClick,
}: {
  kind: "pass" | "fail";
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const on = kind === "pass" ? "border-pass bg-pass text-white" : "border-fail bg-fail text-white";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`h-7 min-w-[44px] rounded-[6px] border px-2 sm:min-w-[48px] sm:px-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-default ${
        pressed ? on : "border-line bg-bg text-muted enabled:hover:border-fg/25 enabled:hover:text-fg"
      }`}
    >
      {kind === "pass" ? "Pass" : "Fail"}
    </button>
  );
}
