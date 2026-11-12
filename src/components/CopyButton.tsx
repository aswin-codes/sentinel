"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className = "",
  iconOnly = false,
}: {
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(typeof text === "function" ? text() : text);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? (copied ? copiedLabel : label) : undefined}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-line bg-bg px-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {!iconOnly && (
        // Both labels share one grid cell so the button width never changes on copy.
        <span className="inline-grid">
          <span className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}>{label}</span>
          <span className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`} aria-hidden={!copied}>
            {copiedLabel}
          </span>
        </span>
      )}
    </button>
  );
}
