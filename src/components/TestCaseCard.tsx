"use client";

import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { copyText } from "./CopyButton";
import { RichText } from "./InlineCode";
import type { CaseWithResult, ResultStatus } from "./types";
import { smallLabel } from "./ui";

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
      setNotesOpen(true);
      if (!savedNotes) focusOnOpen.current = true;
    }
    onStatus(next);
  };

  const promptText = () =>
    (c.agentPrompt ?? "") + (status === "fail" && draft.trim() ? `\n\nObserved failure: ${draft.trim()}` : "");

  return (
    <article aria-label={`${c.code} ${c.title}`} className="rounded-[8px] border border-line bg-bg">
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5">
            <span className="shrink-0 font-mono text-[12px] text-subtle">{c.code}</span>
            <h3 className="min-w-0 text-[14.5px] font-medium leading-snug">
              <RichText text={c.title} />
            </h3>
          </div>
          {c.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex h-5 items-center rounded-[4px] border border-line px-1.5 text-[11px] text-muted"
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Result for ${c.code}`}>
          <StatusButton kind="pass" pressed={status === "pass"} onClick={() => toggle("pass")} />
          <StatusButton kind="fail" pressed={status === "fail"} onClick={() => toggle("fail")} />
        </div>
      </div>

      <div className="grid gap-5 px-4 pb-4 pt-4 sm:grid-cols-2 sm:gap-6 sm:px-5">
        <div className="min-w-0">
          <div className={`${smallLabel} mb-2`}>Steps</div>
          {c.steps.length ? (
            <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
              {c.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-4 shrink-0 text-right text-[12.5px] leading-[1.7] text-subtle tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="min-w-0">
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-subtle">No steps.</p>
          )}
        </div>
        <div className="min-w-0 self-start rounded-[6px] bg-surface px-3.5 py-3">
          <div className={`${smallLabel} mb-2`}>Expected</div>
          {c.expected.length ? (
            <ul className="space-y-1.5 text-[13.5px] leading-relaxed">
              {c.expected.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-subtle" />
                  <span className="min-w-0">
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-subtle">Not specified.</p>
          )}
        </div>
      </div>

      {(status === "fail" || c.agentPrompt) && (
        <div className="space-y-2.5 border-t border-line px-4 py-3 sm:px-5">
          {status === "fail" && (
            <div>
              <button
                type="button"
                onClick={() => setNotesOpen((o) => !o)}
                aria-expanded={notesOpen}
                aria-controls={notesId}
                className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] text-[13px] text-muted hover:text-fg"
              >
                <ChevronDown aria-hidden className={`size-3.5 shrink-0 transition-transform ${notesOpen ? "" : "-rotate-90"}`} />
                <span className="shrink-0">Failure notes</span>
                {!notesOpen && draft.trim() && <span className="min-w-0 truncate text-subtle">— {draft.trim()}</span>}
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
                  placeholder="What went wrong? Observed behaviour, error text…"
                  aria-label={`Failure notes for ${c.code}`}
                  rows={3}
                  className="mt-2 block w-full resize-y rounded-[6px] border border-line bg-bg px-3 py-2 text-[13.5px] leading-relaxed placeholder:text-subtle transition-colors focus:border-fg/40 focus:outline-none focus:ring-2 focus:ring-fg/10"
                />
              )}
            </div>
          )}
          {c.agentPrompt && <CopyPromptButton text={promptText} failed={status === "fail"} />}
        </div>
      )}
    </article>
  );
}

function CopyPromptButton({ text, failed }: { text: () => string; failed: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await copyText(text()))) return;
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-[6px] text-[13px] text-muted transition-colors hover:text-fg"
    >
      <Icon className="size-3.5" aria-hidden />
      {copied ? "Copied" : failed ? "Copy agent prompt with notes" : "Copy agent prompt"}
    </button>
  );
}

function StatusButton({ kind, pressed, onClick }: { kind: "pass" | "fail"; pressed: boolean; onClick: () => void }) {
  const on = kind === "pass" ? "border-pass bg-pass text-white" : "border-fail bg-fail text-white";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-8 min-w-[60px] rounded-[6px] border px-3 text-[13px] font-medium transition-colors ${
        pressed ? on : "border-line bg-bg text-muted hover:border-fg/25 hover:text-fg"
      }`}
    >
      {kind === "pass" ? "Pass" : "Fail"}
    </button>
  );
}
