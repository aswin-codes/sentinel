"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errMsg } from "./api";
import { CopyButton } from "./CopyButton";
import { InlineCode } from "./InlineCode";
import { Modal } from "./Modal";
import type { CreatedToken, McpSetup } from "./types";
import { btnSecondary, smallLabel } from "./ui";

type TabId = "claude" | "cursor" | "antigravity";

const TABS: { id: TabId; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "antigravity", label: "Antigravity" },
];

const PLACEHOLDER = "snt_YOUR_TOKEN";

type Snippets = { cli: string; claudeJson: string; cursorJson: string; antigravityJson: string };
const json = (servers: Record<string, unknown>) => JSON.stringify({ mcpServers: { sentinel: servers } }, null, 2);

/** Hosted: nothing to install — the agent talks to <origin>/api/mcp over HTTP with the token. */
function cloudSnippets(appUrl: string, tok: string): Snippets {
  const url = `${appUrl.replace(/\/$/, "")}/api/mcp`;
  const headers = { Authorization: `Bearer ${tok}` };
  return {
    cli: `claude mcp add --transport http sentinel ${url} --header "Authorization: Bearer ${tok}"`,
    claudeJson: json({ type: "http", url, headers }),
    cursorJson: json({ url, headers }),
    antigravityJson: json({ serverUrl: url, headers }),
  };
}

/** Local: the agent starts the stdio server from this checkout (can also read git itself). */
function localSnippets(appDir: string, tok: string): Snippets {
  const tsx = `${appDir}/node_modules/tsx/dist/cli.mjs`;
  const entry = `${appDir}/mcp-server/index.ts`;
  const config = json({ command: "node", args: [tsx, entry], env: { SENTINEL_TOKEN: tok } });
  return {
    cli: `claude mcp add sentinel -e SENTINEL_TOKEN=${tok} -- node ${tsx} ${entry}`,
    claudeJson: config,
    cursorJson: config,
    antigravityJson: config,
  };
}

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
  mcp,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  /** cloud → hosted HTTP endpoint (<origin>/api/mcp); local → stdio server from this checkout. */
  mcp: McpSetup;
  projectName: string;
}) {
  const [tab, setTab] = useState<TabId>("claude");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tok = token ?? PLACEHOLDER;
  const snippets = mcp.mode === "cloud" ? cloudSnippets(mcp.appUrl, tok) : localSnippets(mcp.appDir, tok);
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
          <p className="mb-3">
            {mcp.mode === "cloud"
              ? "Connects to Sentinel's hosted MCP server — nothing to install."
              : "Runs Sentinel's MCP server from this local copy of the app."}
          </p>
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
                <CodeBlock label="Terminal" code={snippets.cli} />
                <p>
                  Or add it to <InlineCode>.mcp.json</InlineCode> (project) or <InlineCode>~/.claude.json</InlineCode>{" "}
                  (all projects):
                </p>
                <CodeBlock label=".mcp.json" code={snippets.claudeJson} />
              </>
            )}
            {tab === "cursor" && (
              <>
                <p>
                  Add this to <InlineCode>.cursor/mcp.json</InlineCode> in your project (or{" "}
                  <InlineCode>~/.cursor/mcp.json</InlineCode>), then enable <span className="text-fg">sentinel</span> in
                  Settings → MCP.
                </p>
                <CodeBlock label=".cursor/mcp.json" code={snippets.cursorJson} />
              </>
            )}
            {tab === "antigravity" && (
              <>
                <p>
                  Agent panel menu → MCP Servers → Manage → View raw config, then merge this into{" "}
                  <InlineCode>mcp_config.json</InlineCode>:
                </p>
                <CodeBlock label="mcp_config.json" code={snippets.antigravityJson} />
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
