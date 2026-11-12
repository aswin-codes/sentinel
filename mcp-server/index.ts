/**
 * Sentinel — LOCAL stdio MCP server (for running Sentinel on your own machine).
 * The hosted equivalent is the Streamable HTTP endpoint at /api/mcp. Both register the
 * same tools via src/lib/mcp.ts; only this local one can read git (inspect_repo_changes).
 *
 * IMPORTANT: stdout is the MCP protocol channel. Never console.log — log to stderr only.
 */
import fs from "node:fs";
import path from "node:path";

// Load .env from the repo root regardless of cwd, BEFORE importing ../src/db (pg Pool reads DATABASE_URL).
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const log = (...args: unknown[]) => console.error("[sentinel-mcp]", ...args);
const APP_URL = (process.env.SENTINEL_URL ?? process.env.QA_HUB_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function main() {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { pool } = await import("../src/db");
  const { getUserByApiToken } = await import("../src/lib/auth");
  const { createSentinelMcpServer } = await import("../src/lib/mcp");

  // Resolve the user from SENTINEL_TOKEN. Fail fast — every tool is scoped to this user.
  const tokenHelp =
    `Create a personal API token in Sentinel (${APP_URL}/settings → API tokens) and pass it as the SENTINEL_TOKEN ` +
    "env var. Easiest: open your project in Sentinel → Connect agent, and copy the command shown there.";
  const rawToken = (process.env.SENTINEL_TOKEN ?? process.env.QA_HUB_TOKEN)?.trim();
  const user = rawToken ? await getUserByApiToken(rawToken) : null;
  if (!user) {
    log(`${rawToken ? "SENTINEL_TOKEN is invalid or has been revoked." : "SENTINEL_TOKEN is not set."} ${tokenHelp}`);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const server = createSentinelMcpServer({ user, appUrl: APP_URL, mode: "local", log });

  let closing = false;
  const shutdown = async (reason: string) => {
    if (closing) return;
    closing = true;
    log(`shutting down (${reason})`);
    await server.close().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.stdin.on("end", () => void shutdown("stdin closed"));
  process.stdin.on("close", () => void shutdown("stdin closed"));

  await server.connect(new StdioServerTransport());
  const contact = user.email ?? user.phone;
  log(`ready as ${contact ? `${user.name} <${contact}>` : user.name} (env:${fs.existsSync(envPath) ? envPath : "none"})`);
}

main().catch((e) => {
  log("fatal:", e);
  process.exit(1);
});
