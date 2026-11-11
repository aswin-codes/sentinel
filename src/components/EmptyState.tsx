import { Plug, Plus } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { btnPrimary, btnSecondary, monoLabel } from "./ui";

function Frame({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-[12vh] w-full max-w-[520px] px-4">
      <div className="rounded-[10px] border border-line bg-surface p-6 sm:p-7">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">{eyebrow}</div>
        <h1 className="mt-2.5 text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function NoProjects({ onNewProject, onConnect }: { onNewProject: () => void; onConnect: () => void }) {
  return (
    <Frame eyebrow="Welcome to QA Hub" title="Create your first project">
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        A project points at a local repo. Your coding agent inspects its changes and writes a test plan here; you run
        it as a Pass/Fail checklist.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onNewProject} className={btnPrimary}>
          <Plus className="size-3.5" aria-hidden />
          New project
        </button>
        <button type="button" onClick={onConnect} className={btnSecondary}>
          <Plug className="size-3.5 text-accent" aria-hidden />
          Connect agent
        </button>
      </div>
    </Frame>
  );
}

export function NoPlans({ projectName, onConnect }: { projectName: string; onConnect: () => void }) {
  const prompt = `Inspect my recent changes in ${projectName} and create a QA test plan for them in QA Hub.`;
  return (
    <Frame eyebrow={projectName} title="No test plans yet">
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Plans are written by your coding agent. Connect it to QA Hub&apos;s MCP server, then ask:
      </p>
      <div className="mt-4 rounded-[8px] border border-line bg-surface-2 px-3.5 py-3">
        <div className={`${monoLabel} mb-1.5`}>Prompt</div>
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-[13.5px] text-fg/90">&ldquo;{prompt}&rdquo;</p>
          <CopyButton text={prompt} iconOnly label="Copy prompt" className="h-6 shrink-0 px-1.5" />
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">New plans appear here automatically when you come back to this tab.</p>
      <div className="mt-5">
        <button type="button" onClick={onConnect} className={btnPrimary}>
          <Plug className="size-3.5" aria-hidden />
          Connect agent
        </button>
      </div>
    </Frame>
  );
}

export function LoadingBlock() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-12 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-56 animate-pulse rounded bg-surface-2" />
      <div className="mt-4 h-8 w-[min(480px,80%)] animate-pulse rounded bg-surface-2" />
      <div className="mt-4 h-4 w-[min(620px,90%)] animate-pulse rounded bg-surface" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-[10px] border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Frame eyebrow="Something went wrong" title="Couldn't load data">
      <p className="mt-2 font-mono text-[12.5px] text-rose-300">{message}</p>
      <div className="mt-5">
        <button type="button" onClick={onRetry} className={btnSecondary}>
          Retry
        </button>
      </div>
    </Frame>
  );
}
