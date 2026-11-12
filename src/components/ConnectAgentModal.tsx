"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errMsg } from "./api";
import { CopyButton } from "./CopyButton";
import { InlineCode } from "./InlineCode";
import { Modal } from "./Modal";
import type { CreatedToken } from "./types";
import { btnSecondary, smallLabel } from "./ui";

type TabId = "claude" | "cursor" | "antigravity";

const TABS: { id: TabId; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "antigravity", label: "Antigravity" },
];

const PLACEHOLDER = "snt_YOUR_TOKEN";
const DIR_PLACEHOLDER = "<path-to-sentinel>";

export const examplePrompt = (projectName: string) =>
  `Inspect my recent changes in ${projectName} and create a QA test plan for them in Sentinel.`;

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-1.5">
        <span className="font-mono text-[11.5px] text-muted">{label}</span>
        <CopyButton text={code} className="h-6 px-2" />
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ConnectAgentModal({
  open,
  onClose,
  appDir,
  appUrl,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  /** Local Sentinel checkout; null when hosted (the server's own path is useless to the user). */
  appDir: string | null;
  /** Public URL when hosted, so plan links the agent returns point at the deployment. */
  appUrl: string | null;
  projectName: string;
}) {
  const [tab, setTab] = useState<TabId>("claude");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tok = token ?? PLACEHOLDER;
  const dir = appDir ?? DIR_PLACEHOLDER;
  const tsx = `${dir}/node_modules/tsx/dist/cli.mjs`;
  const entry = `${dir}/mcp-server/index.ts`;
  const env: Record<string, string> = { SENTINEL_TOKEN: tok, ...(appUrl ? { SENTINEL_URL: appUrl } : {}) };
  const config = JSON.stringify({ mcpServers: { sentinel: { command: "node", args: [tsx, entry], env } } }, null, 2);
  const cli =
    `claude mcp add sentinel ` +
    Object.entries(env)
      .map(([k, v]) => `-e ${k}=${v} `)
      .join("") +
    `-- node ${tsx} ${entry}`;
  const prompt = examplePrompt(projectName);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const agent = TABS.find((t) => t.id === tab)?.label ?? "Agent";
    try {
      const t = await api<CreatedToken>("/api/tokens", { method: "POST", body: { name: `${agent} – ${projectName}` } });
      setToken(t.token);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect an agent"
      description="Add Sentinel's MCP server to your coding agent so it can write test plans and read failures."
      width={640}
    >
      <div className="space-y-5 text-[13px] text-muted">
        <div>
          <div className={`${smallLabel} mb-2`}>1 · API token</div>
          {token ? (
            <p>
              Token generated and filled in below. <span className="text-fg">It&apos;s only shown once</span> — copy
              the config now. Manage tokens in{" "}
              <Link href="/settings" className="text-fg underline underline-offset-4" onClick={onClose}>
                Settings → API tokens
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={generate} disabled={busy} className={btnSecondary}>
                {busy ? "Generating…" : "Generate token"}
              </button>
              <span>
                Or use an existing one from{" "}
                <Link href="/settings" className="text-fg underline underline-offset-4" onClick={onClose}>
                  Settings
                </Link>{" "}
                in place of <InlineCode>{PLACEHOLDER}</InlineCode>.
              </span>
            </div>
          )}
          {error && <p className="mt-2 text-fail">{error}</p>}
        </div>

        <div>
          <div className={`${smallLabel} mb-2`}>2 · Add the server</div>
          {!appDir && (
            <p className="mb-3">
              The MCP server runs on your computer from a local copy of Sentinel (with{" "}
              <InlineCode>npm install</InlineCode> done and the same <InlineCode>DATABASE_URL</InlineCode> in its{" "}
              <InlineCode>.env</InlineCode>). Replace <InlineCode>{DIR_PLACEHOLDER}</InlineCode> with that folder, e.g.{" "}
              <InlineCode>D:/Projects/sentinel</InlineCode>.
            </p>
          )}
          <div role="tablist" aria-label="Agent" className="mb-3 flex gap-4 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b px-0.5 pb-2 text-[13px] transition-colors ${
                  tab === t.id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="space-y-3">
            {tab === "claude" && (
              <>
                <p>Run this in your project&apos;s terminal:</p>
                <CodeBlock label="Terminal" code={cli} />
                <p>
                  Or add it to <InlineCode>.mcp.json</InlineCode> (project) or <InlineCode>~/.claude.json</InlineCode>{" "}
                  (all projects):
                </p>
                <CodeBlock label=".mcp.json" code={config} />
              </>
            )}
            {tab === "cursor" && (
              <>
                <p>
                  Add this to <InlineCode>.cursor/mcp.json</InlineCode> in your project (or{" "}
                  <InlineCode>~/.cursor/mcp.json</InlineCode>), then enable <span className="text-fg">sentinel</span> in
                  Settings → MCP.
                </p>
                <CodeBlock label=".cursor/mcp.json" code={config} />
              </>
            )}
            {tab === "antigravity" && (
              <>
                <p>
                  Agent panel menu → MCP Servers → Manage → View raw config, then merge this into{" "}
                  <InlineCode>mcp_config.json</InlineCode>:
                </p>
                <CodeBlock label="mcp_config.json" code={config} />
              </>
            )}
          </div>
        </div>

        <div>
          <div className={`${smallLabel} mb-2`}>3 · Ask your agent</div>
          <div className="flex items-start gap-3 rounded-[8px] border border-line px-3 py-2.5">
            <p className="min-w-0 flex-1 text-fg">{prompt}</p>
            <CopyButton text={prompt} iconOnly label="Copy example prompt" className="h-6 shrink-0 px-1.5" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
