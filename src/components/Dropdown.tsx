"use client";

import { Check, ChevronDown } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

export type DropdownItem = {
  key: string;
  label: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  /** When defined, the item is a radio option (checkmark when true). */
  selected?: boolean;
  dividerBefore?: boolean;
  onSelect: () => void;
};

export function Dropdown({
  trigger,
  items,
  ariaLabel,
  align = "left",
  disabled,
  triggerClassName = "",
  emptyLabel = "Nothing here yet",
}: {
  trigger: React.ReactNode;
  items: DropdownItem[];
  ariaLabel: string;
  align?: "left" | "right";
  disabled?: boolean;
  triggerClassName?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    // Focus the selected (or first) item.
    const menu = menuRef.current;
    const target =
      menu?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      menu?.querySelector<HTMLElement>('[role^="menuitem"]');
    target?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    if (!els.length) return;
    const idx = els.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (e.key === "ArrowDown") next = (idx + 1) % els.length;
    else if (e.key === "ArrowUp") next = (idx - 1 + els.length) % els.length;
    else if (e.key === "End") next = els.length - 1;
    els[next].focus();
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-[6px] px-2 text-[13px] text-fg transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 ${
          open ? "bg-surface-2" : ""
        } ${triggerClassName}`}
      >
        <span className="min-w-0 truncate">{trigger}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onMenuKey}
          className={`absolute top-full z-50 mt-1.5 max-h-[min(420px,70vh)] w-max min-w-[220px] max-w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-[10px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.length === 0 && <div className="px-2.5 py-2 text-[13px] text-muted">{emptyLabel}</div>}
          {items.map((it) => (
            <Fragment key={it.key}>
              {it.dividerBefore && <div role="separator" className="mx-1 my-1 h-px bg-line" />}
              <button
                type="button"
                role={it.selected === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={it.selected === undefined ? undefined : it.selected}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-fg/90 outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                {it.selected !== undefined ? (
                  <Check
                    aria-hidden
                    className={`size-3.5 shrink-0 ${it.selected ? "text-accent" : "invisible"}`}
                  />
                ) : (
                  it.icon && <span className="shrink-0 text-muted">{it.icon}</span>
                )}
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.meta && <span className="shrink-0 font-mono text-[11.5px] text-muted">{it.meta}</span>}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
