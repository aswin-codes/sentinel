"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectFormModal } from "./ProjectFormModal";
import { relativeTime } from "./time";
import type { ProjectListItem } from "./types";
import { btnPrimary } from "./ui";

export function ProjectsView({ projects }: { projects: ProjectListItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const openNew = () => {
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const newButton = (
    <button type="button" onClick={openNew} className={btnPrimary}>
      <Plus className="size-3.5" aria-hidden />
      New project
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Projects</h1>
        {projects.length > 0 && newButton}
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-[8px] border border-line px-6 py-20 text-center">
          <h2 className="text-[15px] font-medium">No projects yet</h2>
          <p className="mt-1.5 max-w-[380px] text-[13.5px] leading-relaxed text-muted">
            Create a project for each codebase you test. Your coding agent will add test plans to it.
          </p>
          <div className="mt-6">{newButton}</div>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[8px] border border-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,260px)_72px_96px] gap-6 border-b border-line bg-surface px-4 py-2 text-[12px] text-muted md:grid">
            <span>Name</span>
            <span>Repository</span>
            <span className="text-right">Plans</span>
            <span className="text-right">Updated</span>
          </div>
          <ul className="divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="grid gap-1 px-4 py-3.5 transition-colors hover:bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,260px)_72px_96px] md:items-center md:gap-6"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{p.name}</div>
                    {p.description && <div className="truncate text-[13px] text-muted">{p.description}</div>}
                  </div>
                  <div className="min-w-0 truncate font-mono text-[12px] text-subtle" title={p.repoPath ?? undefined}>
                    {p.repoPath ?? <span className="font-sans">—</span>}
                  </div>
                  <div className="text-[13px] tabular-nums text-muted md:text-right">
                    {p.planCount}
                    <span className="md:hidden" suppressHydrationWarning> {p.planCount === 1 ? "plan" : "plans"} · {relativeTime(p.updatedAt)}</span>
                  </div>
                  <div className="hidden text-right text-[13px] text-muted md:block" suppressHydrationWarning>
                    {relativeTime(p.updatedAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProjectFormModal
        key={formKey}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(p) => {
          setOpen(false);
          router.push(`/projects/${p.id}`);
        }}
      />
    </>
  );
}
