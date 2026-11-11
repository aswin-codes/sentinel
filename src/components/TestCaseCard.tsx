"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { CopyButton } from "./CopyButton";
import { RichText } from "./InlineCode";
import { Tag } from "./Tag";
import type { CaseWithResult, ResultStatus } from "./types";
import { monoLabel } from "./ui";

const NOTES_DEBOUNCE_MS = 800;

export function TestCaseCard({
  c,
  onStatus,
  onSaveNotes,
}: {
  c: CaseWithResult;
  onStatus: (status: ResultStatus) => void;
  onSaveNotes: (notes: string | null) => void;
}) {
  const status = c.result.status;
  const savedNotes = c.result.notes;
  const notesId = useId();

  const [notesOpen, setNotesOpen] = useState(status === "fail");
  const [draft, setDraft] = useState(savedNotes ?? "");
  // Sync draft when notes change from outside (e.g. Clear marks, run switch).
  const [prevSaved, setPrevSaved] = useState(savedNotes);
  if (savedNotes !== prevSaved) {
    setPrevSaved(savedNotes);
    setDraft(savedNotes ?? "");
  }

  const savedRef = useRef(savedNotes);
  const onSaveRef = useRef(onSaveNotes);
  useEffect(() => {
    savedRef.current = savedNotes;
    onSaveRef.current = onSaveNotes;
  });
  const timer = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusOnOpen = useRef(false);

  const commit = (value: string) => {
    window.clearTimeout(timer.current);
    const next = value.trim() ? value : null;
    if (next === (savedRef.current ?? null)) return;
    onSaveRef.current(next);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (notesOpen && status === "fail" && focusOnOpen.current) {
      focusOnOpen.current = false;
      textareaRef.current?.focus();
    }
  }, [notesOpen, status]);

  const toggle = (target: "pass" | "fail") => {
    const next: ResultStatus = status === target ? "not_run" : target;
    if (next === "fail") {
      // Auto-open the notes when a case is first marked failed.
      setNotesOpen(true);
      if (!savedNotes) focusOnOpen.current = true;
    }
    onStatus(next);
  };

  const accentBorder =
    status === "pass" ? "border-l-[3px] border-l-pass" : status === "fail" ? "border-l-[3px] border-l-fail" : "";

  const promptText = () =>
    (c.agentPrompt ?? "") + (status === "fail" && draft.trim() ? `\n\nObserved failure: ${draft.trim()}` : "");

  return (
    <article
      aria-label={`${c.code} ${c.title}`}
      className={`rounded-[10px] border border-line bg-surface transition-colors ${accentBorder}`}
    >
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="inline-flex h-[22px] items-center rounded-[5px] border border-line bg-surface-2 px-1.5 font-mono text-[11.5px] font-medium text-muted">
            {c.code}
          </span>
          <h3 className="min-w-0 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-fg">
            <RichText text={c.title} />
          </h3>
          {c.tags.map((t) => (
            <Tag key={t.label} label={t.label} color={t.color} />
          ))}
        </div>
        <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Result for ${c.code}`}>
          <StatusButton kind="pass" pressed={status === "pass"} onClick={() => toggle("pass")} />
          <StatusButton kind="fail" pressed={status === "fail"} onClick={() => toggle("fail")} />
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 pt-4 sm:grid-cols-[1.25fr_1fr] sm:gap-5 sm:px-5">
        <div className="min-w-0">
          <div className={`${monoLabel} mb-2`}>Steps</div>
          {c.steps.length ? (
            <ol className="space-y-1.5 text-[14px] leading-relaxed text-fg/85">
              {c.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[3px] w-4 shrink-0 text-right font-mono text-[11.5px] text-muted tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="min-w-0">
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">No steps.</p>
          )}
        </div>
        <div className="min-w-0 self-start rounded-[8px] border border-line bg-surface-2 px-3.5 py-3">
          <div className={`${monoLabel} mb-2`}>Expected</div>
          {c.expected.length ? (
            <ul className="space-y-1.5 text-[14px] leading-relaxed text-fg/85">
              {c.expected.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-muted/70" />
                  <span className="min-w-0">
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Not specified.</p>
          )}
        </div>
      </div>

      {(status === "fail" || c.agentPrompt) && (
        <div className="space-y-3 border-t border-line px-4 py-3 sm:px-5">
          {status === "fail" && (
            <div>
              <button
                type="button"
                onClick={() => setNotesOpen((o) => !o)}
                aria-expanded={notesOpen}
                aria-controls={notesId}
                className="inline-flex items-center gap-1.5 rounded-[6px] text-[12.5px] font-medium text-rose-300 hover:text-rose-200"
              >
                <ChevronDown
                  aria-hidden
                  className={`size-3.5 transition-transform ${notesOpen ? "" : "-rotate-90"}`}
                />
                {draft.trim() ? "Failure notes" : "What went wrong?"}
                {!notesOpen && draft.trim() && (
                  <span className="max-w-[40ch] truncate font-normal text-muted">— {draft.trim()}</span>
                )}
              </button>
              {notesOpen && (
                <textarea
                  id={notesId}
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    window.clearTimeout(timer.current);
                    timer.current = window.setTimeout(() => commit(v), NOTES_DEBOUNCE_MS);
                  }}
                  onBlur={() => commit(draft)}
                  placeholder="What went wrong? Observed behaviour, error text, screenshots path…"
                  aria-label={`Failure notes for ${c.code}`}
                  rows={3}
                  className="mt-2 block w-full resize-y rounded-[6px] border border-line bg-surface-2 px-3 py-2 text-[13.5px] leading-relaxed text-fg placeholder:text-muted/70 transition-colors hover:border-line-strong focus:border-fail/50 focus:outline-none focus-visible:outline-none"
                />
              )}
            </div>
          )}
          {c.agentPrompt && (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[12px] text-muted">
                {status === "fail" ? "Hand this failure back to your agent" : "Agent setup prompt available"}
              </span>
              <CopyButton text={promptText} label="Copy agent prompt" className="shrink-0" />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function StatusButton({ kind, pressed, onClick }: { kind: "pass" | "fail"; pressed: boolean; onClick: () => void }) {
  const on =
    kind === "pass"
      ? "border-pass/50 bg-pass/10 text-pass hover:bg-pass/15"
      : "border-fail/50 bg-fail/10 text-fail hover:bg-fail/15";
  const off =
    kind === "pass"
      ? "border-line text-muted hover:border-pass/40 hover:text-pass"
      : "border-line text-muted hover:border-fail/40 hover:text-fail";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-8 min-w-[60px] rounded-[6px] border px-3 text-[13px] font-medium transition-colors ${pressed ? on : off}`}
    >
      {kind === "pass" ? "Pass" : "Fail"}
    </button>
  );
}
