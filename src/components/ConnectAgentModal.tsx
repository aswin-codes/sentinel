"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { Modal } from "./Modal";
import { monoLabel } from "./ui";

type TabId = "claude" | "cursor" | "antigravity";

const TABS: { id: TabId; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "antigravity", label: "Antigravity" },
];

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-line bg-surface-2">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className={monoLabel}>{label}</span>
        <CopyButton text={code} className="h-6 px-2" />
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-fg/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ConnectAgentModal({
  open,
  onClose,
  appDir,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  appDir: string;
  projectName?: string;
}) {
  const [tab, setTab] = useState<TabId>("claude");

  const tsx = `${appDir}/node_modules/tsx/dist/cli.mjs`;
  const entry = `${appDir}/mcp-server/index.ts`;
  const config = JSON.stringify(
    { mcpServers: { "qa-hub": { command: "node", args: [tsx, entry] } } },
    null,
    2,
  );
  const cli = `claude mcp add qa-hub -- node ${tsx} ${entry}`;
  const prompt = `Inspect my recent changes in ${projectName ?? "<project>"} and create a QA test plan for them in QA Hub.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect an agent"
      description="QA Hub ships an MCP server. Add it to your coding agent so it can create plans and read failures."
      width={640}
    >
      <div role="tablist" aria-label="Agent" className="mb-4 inline-flex rounded-[6px] border border-line bg-surface-2 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-7 rounded-[5px] px-3 text-[12.5px] font-medium transition-colors ${
              tab === t.id ? "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-3 text-[13px] text-muted">
        {tab === "claude" && (
          <>
            <p>Run this in your project&apos;s terminal:</p>
            <CodeBlock label="Terminal" code={cli} />
            <p>
              Or add it to <Code>.mcp.json</Code> (project-scoped) or <Code>~/.claude.json</Code> (all projects):
            </p>
            <CodeBlock label=".mcp.json" code={config} />
          </>
        )}
        {tab === "cursor" && (
          <>
            <p>
              Add this to <Code>.cursor/mcp.json</Code> in your project (or <Code>~/.cursor/mcp.json</Code> globally),
              then enable <span className="text-fg/90">qa-hub</span> under Settings → MCP.
            </p>
            <CodeBlock label=".cursor/mcp.json" code={config} />
          </>
        )}
        {tab === "antigravity" && (
          <>
            <p>
              Open the agent panel menu → MCP Servers → Manage → View raw config, and merge this into{" "}
              <Code>mcp_config.json</Code>:
            </p>
            <CodeBlock label="mcp_config.json" code={config} />
          </>
        )}
        <p className="text-[12px]">
          Keep QA Hub&apos;s database running; the MCP server talks to it directly — this web app doesn&apos;t need to be
          open.
        </p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className={`${monoLabel} mb-2`}>Try asking your agent</div>
        <div className="flex items-start gap-3 rounded-[8px] border border-line bg-surface-2 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[13px] text-fg/90">&ldquo;{prompt}&rdquo;</p>
          <CopyButton text={prompt} iconOnly label="Copy example prompt" className="h-6 shrink-0 px-1.5" />
        </div>
      </div>
    </Modal>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[4px] border border-line bg-surface-2 px-1 py-px font-mono text-[12px] text-fg/90">
      {children}
    </code>
  );
}
