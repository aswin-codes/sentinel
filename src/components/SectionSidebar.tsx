"use client";

import { useEffect, useState } from "react";
import type { SectionFull } from "./types";
import { smallLabel } from "./ui";

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
      // Band just below the sticky nav + toolbar, upper ~40% of the viewport.
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 },
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
    <nav
      aria-label="Sections"
      className="sticky top-[132px] hidden max-h-[calc(100vh-150px)] w-[200px] shrink-0 self-start overflow-y-auto lg:block"
    >
      <div className={`${smallLabel} mb-2`}>Sections</div>
      <ul className="space-y-px">
        {sections.map((s) => {
          const total = s.cases.length;
          const done = s.cases.filter((c) => c.result.status !== "not_run").length;
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                aria-current={isActive ? "location" : undefined}
                className={`flex w-full items-center gap-2 rounded-[6px] py-1 text-left text-[13px] transition-colors ${
                  isActive ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-subtle">
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
