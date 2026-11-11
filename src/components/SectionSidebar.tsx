"use client";

import { useEffect, useState } from "react";
import type { SectionFull } from "./types";
import { monoLabel } from "./ui";

export const sectionDomId = (id: number) => `section-${id}`;

/** Highlights the section currently in view (IntersectionObserver). */
function useActiveSection(ids: number[]) {
  const [active, setActive] = useState<number | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    const sectionIds = key ? key.split(",").map(Number) : [];
    const els = sectionIds
      .map((id) => document.getElementById(sectionDomId(id)))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.sectionId);
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = sectionIds.find((id) => visible.has(id));
        if (first !== undefined) setActive(first);
      },
      // Band just below the sticky bars, upper ~40% of the viewport.
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);

  return [active, setActive] as const;
}

export function SectionSidebar({ sections }: { sections: SectionFull[] }) {
  const [active, setActive] = useActiveSection(sections.map((s) => s.id));

  const jump = (id: number) => {
    const el = document.getElementById(sectionDomId(id));
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav aria-label="Sections" className="sticky top-[132px] hidden max-h-[calc(100vh-150px)] w-[220px] shrink-0 self-start overflow-y-auto min-[860px]:block">
      <div className={`${monoLabel} mb-2.5 px-2.5`}>Sections</div>
      <ul className="space-y-px">
        {sections.map((s) => {
          const total = s.cases.length;
          const pass = s.cases.filter((c) => c.result.status === "pass").length;
          const fail = s.cases.filter((c) => c.result.status === "fail").length;
          const done = pass + fail;
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                aria-current={isActive ? "location" : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  isActive ? "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-muted hover:bg-surface/60 hover:text-fg"
                }`}
              >
                <span className="w-3.5 shrink-0 font-mono text-[12px] font-semibold text-accent">{s.code}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    fail ? "text-fail" : total > 0 && done === total ? "text-pass" : "text-muted"
                  }`}
                >
                  {done}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
