/**
 * Pure data/builder layer for the "Connect agent" dialog (no React).
 * Produces, per coding agent: the config file path, the raw config snippet,
 * an optional CLI one-liner and a natural-language setup prompt.
 */
import type { McpSetup } from "./types";

export type AgentId =
  | "claude-code"
  | "cursor"
  | "copilot"
  | "windsurf"
  | "antigravity"
  | "codex"
  | "gemini"
  | "cline"
  | "roo"
  | "generic";

export const AGENTS: { id: AgentId; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "copilot", label: "GitHub Copilot" },
  { id: "windsurf", label: "Windsurf" },
  { id: "antigravity", label: "Antigravity" },
  { id: "codex", label: "Codex CLI" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "cline", label: "Cline" },
  { id: "roo", label: "Roo Code" },
  { id: "generic", label: "Generic" },
];

export const TOKEN_PLACEHOLDER = "snt_YOUR_TOKEN";

export type AgentGuide = {
  name: string;
  configPath: string;
  configLang: "json" | "toml";
  configSnippet: string;
  cli?: string;
  setupPrompt: string;
};

type Server = Record<string, unknown>;

type Endpoint =
  | { mode: "cloud"; url: string; headers: { Authorization: string } }
  | { mode: "local"; command: string; args: string[]; env: { SENTINEL_TOKEN: string }; tsx: string; entry: string };

function endpoint(setup: McpSetup, token: string): Endpoint {
  if (setup.mode === "cloud") {
    return {
      mode: "cloud",
      url: `${setup.appUrl.replace(/\/+$/, "")}/api/mcp`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  const dir = setup.appDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const tsx = `${dir}/node_modules/tsx/dist/cli.mjs`;
  const entry = `${dir}/mcp-server/index.ts`;
  return { mode: "local", command: "node", args: [tsx, entry], env: { SENTINEL_TOKEN: token }, tsx, entry };
}

const toJson = (v: unknown) => JSON.stringify(v, null, 2);
const q = (s: string) => JSON.stringify(s); // valid JSON string; also a valid TOML basic string

/** stdio server body shared by most clients. */
const stdio = (e: Extract<Endpoint, { mode: "local" }>): Server => ({
  command: e.command,
  args: e.args,
  env: e.env,
});

function tomlBlock(e: Endpoint): string {
  if (e.mode === "cloud") {
    return [
      "[mcp_servers.sentinel]",
      `url = ${q(e.url)}`,
      `http_headers = { Authorization = ${q(e.headers.Authorization)} }`,
    ].join("\n");
  }
  return [
    "[mcp_servers.sentinel]",
    `command = ${q(e.command)}`,
    `args = [${e.args.map(q).join(", ")}]`,
    "",
    "[mcp_servers.sentinel.env]",
    `SENTINEL_TOKEN = ${q(e.env.SENTINEL_TOKEN)}`,
  ].join("\n");
}

const TOOLS_HELP = `Once connected, these Sentinel tools are available:
- list_projects: list my projects (with their repositories)
- create_project: create a project (name, description, repos: [{label, path}] for multi-repo projects)
- inspect_repo_changes: read git status/diff of a project's repos (optional repo label)
- upsert_test_plan: create or update a feature test plan (sections, cases, steps, expected results)
- get_test_plan: read a plan with the results of a run
- get_failed_test_cases: list failing cases so you can fix them
- get_project_stats: pass/fail rates, most-failing cases and trends for a project`;

function buildPrompt(opts: {
  name: string;
  e: Endpoint;
  configPath: string;
  lang: "json" | "toml";
  snippet: string;
  cli?: string;
  reload: string;
  token: string;
}): string {
  const { name, e, configPath, lang, snippet, cli, reload, token } = opts;
  const mode =
    e.mode === "cloud"
      ? `Sentinel is a hosted MCP server (Streamable HTTP) at ${e.url}, authenticated with an Authorization: Bearer header.`
      : `Sentinel runs locally as a stdio MCP server started with node (${e.entry}); the API token is passed in the SENTINEL_TOKEN env var.`;
  const tokenNote =
    token === TOKEN_PLACEHOLDER
      ? `Replace ${TOKEN_PLACEHOLDER} with my Sentinel API token (create one in Sentinel under Settings > API tokens). Ask me for it if you don't have it.`
      : "The API token below is already filled in. Treat it as a secret: don't print it again or commit it to git.";
  return [
    `Set up the Sentinel MCP server in ${name} so you can write and read test plans for me.`,
    "",
    mode,
    "",
    `1. Open (or create) ${configPath}. If it already exists, merge the "sentinel" entry into it and keep my other servers.`,
    `2. Add this ${lang === "toml" ? "TOML" : "JSON"}:`,
    "",
    snippet,
    "",
    ...(cli ? [`   (Equivalent CLI: ${cli})`, ""] : []),
    `3. ${tokenNote}`,
    `4. ${reload}`,
    "5. Verify the connection by calling list_projects.",
    "",
    TOOLS_HELP,
    "",
    "Sample request: inspect my recent changes in my Sentinel project, then create a QA test plan for them with upsert_test_plan. When I report failures later, use get_failed_test_cases and fix them.",
  ].join("\n");
}

export function buildAgentGuide(agentId: AgentId, setup: McpSetup, token: string): AgentGuide {
  const e = endpoint(setup, token);
  const cloud = e.mode === "cloud";
  const local = e.mode === "local" ? e : null;
  const remote = e.mode === "cloud" ? e : null;

  const mk = (
    name: string,
    configPath: string,
    configLang: "json" | "toml",
    configSnippet: string,
    reload: string,
    cli?: string,
  ): AgentGuide => ({
    name,
    configPath,
    configLang,
    configSnippet,
    cli,
    setupPrompt: buildPrompt({ name, e, configPath, lang: configLang, snippet: configSnippet, cli, reload, token }),
  });

  const mcpServers = (server: Server) => toJson({ mcpServers: { sentinel: server } });
  const hdr = remote?.headers;

  switch (agentId) {
    case "claude-code": {
      const cli = remote
        ? `claude mcp add --transport http sentinel ${remote.url} --header "Authorization: Bearer ${token}"`
        : `claude mcp add sentinel -e SENTINEL_TOKEN=${token} -- node ${local!.tsx} ${local!.entry}`;
      const server = remote ? { type: "http", url: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Claude Code",
        ".mcp.json (project) or ~/.claude.json (all projects)",
        "json",
        mcpServers(server),
        "Restart Claude Code (or run /mcp) and approve the sentinel server.",
        cli,
      );
    }
    case "cursor": {
      const server = remote ? { url: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Cursor",
        ".cursor/mcp.json (project) or ~/.cursor/mcp.json (global)",
        "json",
        mcpServers(server),
        "Open Cursor Settings > MCP and enable sentinel (reload the window if it does not appear).",
      );
    }
    case "copilot": {
      const server = remote
        ? { type: "http", url: remote.url, headers: hdr }
        : { type: "stdio", ...stdio(local!) };
      // No `code --add-mcp '<json>'` one-liner: single-quoted JSON breaks in PowerShell and cmd.
      // The .vscode/mcp.json snippet works the same everywhere.
      return mk(
        "GitHub Copilot (VS Code)",
        ".vscode/mcp.json (workspace; top-level key is \"servers\")",
        "json",
        toJson({ servers: { sentinel: server } }),
        "In VS Code, click Start above the sentinel entry (or run MCP: List Servers), then use Copilot Chat in Agent mode.",
      );
    }
    case "windsurf": {
      const server = remote ? { serverUrl: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Windsurf",
        "~/.codeium/windsurf/mcp_config.json",
        "json",
        mcpServers(server),
        "In Cascade open the MCP toolbar and click Refresh so sentinel is loaded.",
      );
    }
    case "antigravity": {
      const server = remote ? { serverUrl: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Antigravity",
        "mcp_config.json (Agent panel menu > MCP Servers > Manage > View raw config)",
        "json",
        mcpServers(server),
        "Save the file and refresh the MCP Servers list so sentinel shows as connected.",
      );
    }
    case "codex": {
      const cli = local
        ? `codex mcp add sentinel --env SENTINEL_TOKEN=${token} -- node ${local.tsx} ${local.entry}`
        : undefined;
      return mk(
        "Codex CLI",
        "~/.codex/config.toml",
        "toml",
        tomlBlock(e),
        "Restart Codex (the TUI lists MCP servers with /mcp).",
        cli,
      );
    }
    case "gemini": {
      const server = remote ? { httpUrl: remote.url, headers: hdr } : stdio(local!);
      const cli = remote
        ? `gemini mcp add --transport http sentinel ${remote.url} --header "Authorization: Bearer ${token}"`
        : `gemini mcp add -e SENTINEL_TOKEN=${token} sentinel node ${local!.tsx} ${local!.entry}`;
      return mk(
        "Gemini CLI",
        "~/.gemini/settings.json (or .gemini/settings.json in a project)",
        "json",
        mcpServers(server),
        "Restart Gemini CLI and run /mcp to confirm sentinel is connected.",
        cli,
      );
    }
    case "cline": {
      const server = remote ? { type: "streamableHttp", url: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Cline",
        "cline_mcp_settings.json (Cline panel > MCP Servers > Configure MCP Servers)",
        "json",
        mcpServers(server),
        "Save the file; Cline reloads MCP servers automatically. Confirm sentinel shows a green status.",
      );
    }
    case "roo": {
      const server = remote ? { type: "streamable-http", url: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Roo Code",
        ".roo/mcp.json (project) or the global mcp_settings.json from the MCP Servers panel",
        "json",
        mcpServers(server),
        "Save the file; Roo Code reloads MCP servers automatically. Confirm sentinel shows as enabled.",
      );
    }
    case "generic":
    default: {
      const server = remote ? { url: remote.url, headers: hdr } : stdio(local!);
      return mk(
        "Any MCP client",
        "your client's MCP config file (usually an \"mcpServers\" object)",
        "json",
        mcpServers(server),
        cloud
          ? "Reload the client. If it needs a transport type, choose Streamable HTTP."
          : "Reload the client so it starts the stdio server.",
      );
    }
  }
}
