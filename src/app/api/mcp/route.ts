/**
 * Hosted MCP endpoint (Streamable HTTP, stateless).
 *
 *   claude mcp add --transport http sentinel https://<host>/api/mcp --header "Authorization: Bearer snt_..."
 *
 * Every request authenticates with a personal API token and gets a fresh server scoped to that
 * user — no sessions to keep, which fits serverless hosts like Vercel. Tools are the same as the
 * local stdio server except inspect_repo_changes (the host can't see the user's repo; the agent
 * runs git itself).
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getUserByApiToken, isApiToken } from "@/lib/auth";
import { createSentinelMcpServer } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(message: string) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="sentinel", error="invalid_token"',
    },
  });
}

function originOf(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto =
    req.headers.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

async function handle(req: Request): Promise<Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || !isApiToken(token))
    return unauthorized(
      "Missing API token. Send `Authorization: Bearer snt_...` — create one in Sentinel → Settings → API tokens.",
    );
  const user = await getUserByApiToken(token);
  if (!user) return unauthorized("Invalid or revoked API token. Create a new one in Sentinel → Settings → API tokens.");

  const server = createSentinelMcpServer({ user, appUrl: originOf(req), mode: "remote" });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true, // plain JSON responses, no long-lived SSE streams on serverless
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
