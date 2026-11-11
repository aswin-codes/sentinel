"use client";

import { useEffect, useId, useRef, useState } from "react";

export type MenuItem = {
  key: string;
  label: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

/** Minimal popover menu: click to open, Escape / outside click to close, arrow-key navigation. */
export function Menu({
  trigger,
  ariaLabel,
  items,
  header,
  align = "right",
  triggerClassName = "",
}: {
  trigger: React.ReactNode;
  ariaLabel: string;
  items: MenuItem[];
  header?: React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

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
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
    els[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={onMenuKey}
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-[calc(100%+6px)] z-50 min-w-[180px] rounded-[8px] border border-line bg-bg p-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {header && <div className="border-b border-line px-2.5 pb-2 pt-1.5">{header}</div>}
          <div className={header ? "pt-1" : ""}>
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  it.onSelect();
                }}
                className={`flex w-full items-center rounded-[5px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface focus:bg-surface focus:outline-none ${
                  it.danger ? "text-fail" : "text-fg"
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
