"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errMsg } from "./api";
import { AGENTS, TOKEN_PLACEHOLDER as PLACEHOLDER, buildAgentGuide, type AgentId } from "./agents";
import { CopyButton } from "./CopyButton";
import { InlineCode } from "./InlineCode";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import type { CreatedToken, McpSetup } from "./types";
import { btnSecondary, smallLabel } from "./ui";

export const examplePrompt = (projectName: string) =>
  `Inspect my recent changes in ${projectName} and create a QA test plan for them in Sentinel.`;

function CodeBlock({ code, label, maxH = "max-h-56" }: { code: string; label: string; maxH?: string }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-1.5">
        <span className="font-mono text-[11.5px] text-muted">{label}</span>
        <CopyButton text={code} className="h-6 px-2" />
      </div>
      <pre className={`${maxH} overflow-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed`}>
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
  const [tab, setTab] = useState<AgentId>("claude-code");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tok = token ?? PLACEHOLDER;
  const guide = buildAgentGuide(tab, mcp, tok);
  const prompt = examplePrompt(projectName);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const agent = AGENTS.find((t) => t.id === tab)?.label ?? "Agent";
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
                {busy && <Spinner />}
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
          <div
            role="tablist"
            aria-label="Agent"
            className="mb-3 flex gap-1 overflow-x-auto rounded-[8px] border border-line bg-surface p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {AGENTS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`h-7 shrink-0 whitespace-nowrap rounded-[6px] px-2.5 text-[12.5px] transition-colors ${
                  tab === t.id ? "bg-bg font-medium text-fg ring-1 ring-line" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="min-h-[24rem] space-y-3">
            <div>
              <p className="mb-1.5">
                <span className="text-fg">Setup prompt</span> — paste into {guide.name} and it configures Sentinel
                itself.
              </p>
              <CodeBlock label="Prompt" code={guide.setupPrompt} maxH="max-h-40" />
            </div>
            <div>
              <p className="mb-1.5">
                <span className="text-fg">Or add it manually</span> to <InlineCode>{guide.configPath}</InlineCode>
              </p>
              <CodeBlock label={guide.configLang === "toml" ? "config.toml" : "JSON"} code={guide.configSnippet} />
            </div>
            {guide.cli && (
              <div>
                <p className="mb-1.5">Or with the CLI:</p>
                <CodeBlock label="Terminal" code={guide.cli} maxH="max-h-24" />
              </div>
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
