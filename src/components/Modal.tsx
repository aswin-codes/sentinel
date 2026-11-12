"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "./Spinner";
import { btnDanger, btnGhost, btnPrimary, input } from "./ui";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 480,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  /** When false, Esc / backdrop / X do nothing (e.g. while a request is pending). */
  dismissable?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissRef = useRef(dismissable);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissRef.current = dismissable;
  });

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = dialogRef.current?.querySelector<HTMLElement>("input, textarea, select");
    (first ?? dialogRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="w-full rounded-[10px] border border-line bg-bg outline-none"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissable}
            aria-label="Close dialog"
            className="-mr-1.5 disabled:pointer-events-none disabled:opacity-50 -mt-0.5 rounded-[6px] p-1 text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Small confirm dialog. `onConfirm` may be async; errors are shown inline.
 * `confirmText` adds a type-to-confirm input (exact match, trimmed) that gates the confirm button.
 */
export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  pendingLabel = "Working…",
  confirmText,
  danger = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const inputId = useId();

  const matches = confirmText == null || typed.trim() === confirmText;

  const close = () => {
    if (busy) return;
    setError(null);
    setTyped("");
    onClose();
  };

  const confirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setTyped("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={title} description={description} width={420} dismissable={!busy}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        {confirmText != null && (
          <div className="mb-4">
            <label htmlFor={inputId} className="mb-1.5 block text-[13px] text-muted">
              Type <span className="font-mono text-fg">{confirmText}</span> to confirm
            </label>
            <input
              id={inputId}
              className={input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
            />
          </div>
        )}
        {error && (
          <p role="alert" className="mb-3 text-[13px] text-fail">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} disabled={busy} className={btnGhost}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !matches}
            className={danger ? btnDanger : btnPrimary}
            autoFocus={confirmText == null}
          >
            {busy && <Spinner />}
            {busy ? pendingLabel : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
