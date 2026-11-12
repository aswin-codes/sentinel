"use client";

import { Check, ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "./api";
import { ConfirmModal } from "./Modal";
import { Spinner } from "./Spinner";
import { relativeTime } from "./time";
import type { RunSummary } from "./types";

export type RunDeleteResult = { ok: true; deletedRunId: number; nextRunId: number; recreated: boolean };

/** Quiet popover listing a plan's runs: select to switch, trash icon to delete (with confirmation). */
export function RunPicker({
  runs,
  activeRunId,
  loading = false,
  disabled = false,
  onSelect,
  onDeleted,
}: {
  runs: RunSummary[];
  activeRunId: number | null;
  loading?: boolean;
  disabled?: boolean;
  onSelect: (runId: number) => void;
  onDeleted: (result: RunDeleteResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<RunSummary | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active = runs.find((r) => r.id === activeRunId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const confirmDelete = async () => {
    if (!target) return;
    const res = await api<RunDeleteResult>(`/api/runs/${target.id}`, { method: "DELETE" });
    setTarget(null);
    onDeleted(res);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label="Select run"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 max-w-[200px] items-center gap-1.5 rounded-[6px] border border-line bg-bg pl-2.5 pr-1.5 text-[13px] text-fg transition-colors hover:bg-surface focus:border-fg/40 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="min-w-0 truncate">{active?.name ?? "Run"}</span>
        {loading ? <Spinner className="size-3.5 text-muted" /> : <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted" />}
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Runs"
          className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[320px] w-[280px] overflow-y-auto rounded-[8px] border border-line bg-bg p-1"
        >
          {runs.map((r) => {
            const isActive = r.id === activeRunId;
            return (
              <div key={r.id} className="group flex items-center rounded-[5px] hover:bg-surface focus-within:bg-surface">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) onSelect(r.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-left focus:outline-none"
                >
                  <Check aria-hidden className={`size-3.5 shrink-0 ${isActive ? "text-fg" : "text-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">{r.name}</span>
                    <span className="block text-[11.5px] text-subtle" suppressHydrationWarning>
                      {relativeTime(r.createdAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete run ${r.name}`}
                  title="Delete run"
                  onClick={() => {
                    setOpen(false);
                    setTarget(r);
                  }}
                  className="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-[5px] text-subtle transition-colors hover:text-fail focus:text-fail focus:outline-none"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={target != null}
        onClose={() => setTarget(null)}
        title="Delete run?"
        description={`Delete ${target?.name ?? "this run"}? This removes its Pass/Fail results. Cannot be undone.`}
        confirmLabel="Delete run"
        pendingLabel="Deleting…"
        danger
        onConfirm={confirmDelete}
      />
    </div>
  );
}
