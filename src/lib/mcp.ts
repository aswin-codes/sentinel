/**
 * Sentinel MCP tools — shared by the local stdio server (mcp-server/index.ts) and the
 * hosted Streamable HTTP endpoint (src/app/api/mcp/route.ts). Relative imports only.
 *
 * mode "local":  runs on the user's machine → can read git itself (inspect_repo_changes).
 * mode "remote": runs on the host (e.g. Vercel) → no access to the user's repo, so the agent
 *                runs git in its own terminal and passes branch/commit into upsert_test_plan.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { testPlans } from "../db/schema";
import { assertPlanOwner, assertProjectOwner, type PublicUser } from "./auth";
import { getGitDiff, getGitInfo } from "./git";
import {
  createProject,
  getFailedCases,
  getPlanFull,
  listProjects,
  planInputSchema,
  projectInputSchema,
  upsertPlan,
} from "./plans";

export type McpMode = "local" | "remote";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export function createSentinelMcpServer(opts: {
  user: PublicUser;
  appUrl: string;
  mode: McpMode;
  log?: (...args: unknown[]) => void;
}): McpServer {
  const { user, mode } = opts;
  const log = opts.log ?? ((...a: unknown[]) => console.error("[sentinel-mcp]", ...a));
  const appUrl = opts.appUrl.replace(/\/$/, "");
  const userId = user.id;
  const contact = user.email ?? user.phone;
  const userLabel = contact ? `${user.name} <${contact}>` : user.name;

  const ok = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
  const fail = (message: string, details?: unknown): ToolResult => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(details === undefined ? { error: message } : { error: message, details }, null, 2),
      },
    ],
    isError: true,
  });
  const errMessage = (e: unknown) =>
    e instanceof z.ZodError ? `Invalid input: ${z.prettifyError(e)}` : e instanceof Error ? e.message : String(e);
  /** Thrown errors become isError results instead of protocol errors. */
  const safe =
    <A,>(name: string, fn: (args: A) => Promise<ToolResult>) =>
    async (args: A): Promise<ToolResult> => {
      try {
        return await fn(args);
      } catch (e) {
        log(`${name} failed:`, e);
        return fail(errMessage(e));
      }
    };
  const planUrl = (projectId: number, planId: number) => `${appUrl}/projects/${projectId}/plans/${planId}`;
  const projectUrl = (projectId: number) => `${appUrl}/projects/${projectId}`;

  const changesStep =
    mode === "local"
      ? "inspect_repo_changes (see what changed)"
      : "run `git status`, `git diff` (or `git diff main...HEAD`) and `git log -5 --oneline` in your own terminal to see what changed";

  const server = new McpServer(
    { name: "sentinel", version: "0.3.0" },
    {
      instructions:
        `Sentinel stores manual QA test plans for software projects. You are signed in as ${userLabel}; ` +
        "every tool only sees this user's projects and plans. Typical workflow: " +
        "list_projects (match repoPath to your current working directory) → if no project matches, create_project " +
        `(pass your current working directory as repoPath) → ${changesStep} → ` +
        "get_test_plan (if updating an existing plan) → upsert_test_plan (write the checklist, include gitBranch/commitHash; " +
        "share the returned url) → a human marks cases Pass/Fail in the web UI → get_failed_test_cases (read failures + " +
        "tester notes) → fix the code → upsert again if the plan needs changes.",
    },
  );

  // ---------- list_projects ----------
  server.registerTool(
    "list_projects",
    {
      title: "List projects and their test plans",
      description:
        "List your Sentinel projects (id, name, description, repoPath) together with their test plans " +
        "(id, title, status, updatedAt, url). Call this first to find the projectId for the repo you are working in " +
        "(match repoPath against your current working directory) and to see whether a plan for the feature already " +
        "exists, so you update it instead of creating a duplicate. If no project matches, call create_project.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    safe("list_projects", async () => {
      const projectRows = await listProjects(userId);
      const projectIds = projectRows.map((p) => p.id);
      const planRows = projectIds.length
        ? await db
            .select({
              id: testPlans.id,
              projectId: testPlans.projectId,
              title: testPlans.title,
              status: testPlans.status,
              updatedAt: testPlans.updatedAt,
            })
            .from(testPlans)
            .where(inArray(testPlans.projectId, projectIds))
            .orderBy(desc(testPlans.updatedAt))
        : [];
      return ok(
        projectRows.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          repoPath: p.repoPath,
          url: projectUrl(p.id),
          plans: planRows
            .filter((pl) => pl.projectId === p.id)
            .map((pl) => ({
              id: pl.id,
              title: pl.title,
              status: pl.status,
              updatedAt: pl.updatedAt ? new Date(pl.updatedAt).toISOString() : null,
              url: planUrl(p.id, pl.id),
            })),
        })),
      );
    }),
  );

  // ---------- create_project ----------
  server.registerTool(
    "create_project",
    {
      title: "Create a Sentinel project",
      description:
        "Create a new Sentinel project for the repository you are working in. Use this when list_projects has no " +
        "project matching your repo (compare repoPath with your current working directory). Pass your CURRENT " +
        "WORKING DIRECTORY (absolute path of the repo root) as repoPath so future sessions can match it. Returns the " +
        "project (id, name, description, repoPath, url); use its id for upsert_test_plan.",
      inputSchema: {
        name: z.string().trim().min(1).max(200).describe("Project name, e.g. the repo / product name"),
        description: z.string().optional().describe("Optional one-line description"),
        repoPath: z.string().optional().describe("Absolute path to the repo root — pass your current working directory"),
      },
    },
    safe("create_project", async (args) => {
      const project = await createProject(userId, projectInputSchema.parse(args));
      return ok({
        id: project.id,
        name: project.name,
        description: project.description,
        repoPath: project.repoPath,
        createdAt: project.createdAt.toISOString(),
        url: projectUrl(project.id),
      });
    }),
  );

  // ---------- inspect_repo_changes (local only: needs the repo on this machine) ----------
  if (mode === "local") {
    server.registerTool(
      "inspect_repo_changes",
      {
        title: "Inspect git changes in a project's repo",
        description:
          "Return git context for a project's repository (its configured repoPath): current branch, short commit hash, " +
          "`git status`, `diff --stat`, the last 10 commits, and the full diff. Without `base` the diff is the working " +
          'tree vs HEAD (uncommitted changes); with `base` (e.g. "main") it is everything that differs from that ref, ' +
          "including committed branch work. USE THIS BEFORE WRITING A TEST PLAN so the plan covers what actually " +
          "changed, and pass the returned branch / commitHash into upsert_test_plan (gitBranch, commitHash). " +
          "Large diffs are truncated to maxChars (default 60000); `truncated: true` tells you when that happened.",
        inputSchema: {
          projectId: z.number().int().positive().describe("Project id from list_projects"),
          base: z
            .string()
            .optional()
            .describe('Optional base ref to diff against, e.g. "main" or "origin/main". Omit for uncommitted changes only.'),
          maxChars: z
            .number()
            .int()
            .positive()
            .max(500_000)
            .optional()
            .describe("Truncate the diff to this many characters (default 60000)."),
        },
        annotations: { readOnlyHint: true },
      },
      safe("inspect_repo_changes", async ({ projectId, base, maxChars }) => {
        const project = await assertProjectOwner(userId, projectId).catch(() => null);
        if (!project) return fail(`Project ${projectId} not found. Call list_projects to see valid ids.`);
        if (!project.repoPath)
          return fail(
            `Project ${projectId} (${project.name}) has no repoPath configured; set one in the Sentinel UI (${projectUrl(projectId)}).`,
          );
        const [info, diff] = await Promise.all([
          getGitInfo(project.repoPath),
          getGitDiff(project.repoPath, { base, maxChars }),
        ]);
        if (!info.ok) return fail(`git info failed: ${info.error}`, { repoPath: project.repoPath });
        return ok({
          projectId: project.id,
          projectName: project.name,
          repoPath: project.repoPath,
          base: base ?? null,
          ...info,
          diff: diff.ok ? diff.diff : null,
          diffTruncated: diff.truncated ?? false,
          diffError: diff.ok ? undefined : diff.error,
        });
      }),
    );
  }

  // ---------- upsert_test_plan ----------
  server.registerTool(
    "upsert_test_plan",
    {
      title: "Create or update a QA test plan",
      description: [
        "Create a manual QA test plan (checklist) for a feature, or update an existing one. A human tester then executes",
        "it in the Sentinel web UI, marking each case Pass/Fail with notes.",
        "",
        mode === "local"
          ? "BEFORE WRITING: call inspect_repo_changes so the plan covers what actually changed."
          : "BEFORE WRITING: run `git status` / `git diff` (or `git diff main...HEAD`) in your own terminal so the plan covers what actually changed.",
        "",
        "MATCHING (no duplicates): the plan is matched by `planId` if given, otherwise by (projectId, planTitle). Re-calling",
        "with the same title updates the same plan. Call get_test_plan first when updating, so you keep the existing codes.",
        "",
        "STRUCTURE: sections → cases.",
        '- Section `code`: a short letter, e.g. "S" (Setup), "A", "B", ... Sections are shown in the order given.',
        '- Case `code`: section letter + number, e.g. "S1", "S2", "A1", "A2".',
        "- STABLE CODES PRESERVE RESULTS: sections are matched by code within the plan and cases by code within the section,",
        "  so keeping a case's code keeps its id and its existing Pass/Fail result + notes. Renumbering a case resets it.",
        "- `steps`: ordered actions for the tester. `expected`: observable outcomes to verify. Both may use `backticks`",
        "  for inline code (commands, file paths, env vars, UI labels).",
        "- `tags`: [{label, color}] showing where/how the case is run. Conventions:",
        '  "Terminal" = zinc, "Admin panel" = amber, "Phone" = sky, "Claude sets up" = violet.',
        "  Allowed colors: amber, violet, sky, emerald, rose, zinc.",
        "- `agentPrompt`: a ready-to-paste prompt a coding agent could run to set up the preconditions for this case or to",
        "  fix it if it fails (include file paths, commands and what 'done' looks like).",
        "",
        "MODE: `replace` (default) deletes sections/cases not present in the input — send the whole plan. `merge` only",
        "adds/updates the sections and cases you send and leaves the rest untouched.",
        "Set gitBranch / commitHash (current branch and short HEAD hash). status: draft | active | archived.",
        "",
        "Returns {planId, created, url, counts}. Share the url with the user so they can start testing.",
      ].join("\n"),
      inputSchema: planInputSchema.shape,
    },
    safe("upsert_test_plan", async (args) => {
      if (!(await assertProjectOwner(userId, args.projectId).catch(() => null)))
        return fail(`Project ${args.projectId} not found. Call list_projects (or create_project) first.`);
      if (args.planId && !(await assertPlanOwner(userId, args.planId).catch(() => null)))
        return fail(`Plan ${args.planId} not found. Call list_projects to see valid plan ids.`);
      const { planId, created } = await upsertPlan(args);
      const plan = await getPlanFull(planId);
      return ok({
        planId,
        projectId: args.projectId,
        created,
        url: planUrl(args.projectId, planId),
        title: plan?.title,
        sections: plan?.sections.length ?? 0,
        counts: plan?.counts ?? null,
      });
    }),
  );

  // ---------- get_failed_test_cases ----------
  server.registerTool(
    "get_failed_test_cases",
    {
      title: "Get failed QA test cases",
      description:
        "Return the cases a human tester marked FAIL in a test plan run (default: the latest run), including the " +
        "tester's notes, the original steps/expected results and each case's agentPrompt. USE THIS when the user asks " +
        'you to debug / fix failed QA checks (e.g. "fix the failing tests in Sentinel"). Read the notes carefully — they ' +
        "describe what actually happened. After fixing, tell the user which cases to re-test.",
      inputSchema: {
        planId: z.number().int().positive().describe("Test plan id (see list_projects)"),
        runId: z.number().int().positive().optional().describe("Specific run id; defaults to the latest run"),
      },
      annotations: { readOnlyHint: true },
    },
    safe("get_failed_test_cases", async ({ planId, runId }) => {
      const owned = await assertPlanOwner(userId, planId).catch(() => null);
      const res = owned ? await getFailedCases(planId, runId) : null;
      if (!owned || !res) return fail(`Plan ${planId} not found. Call list_projects to see valid plan ids.`);
      return ok({ ...res, url: planUrl(owned.projectId, planId) });
    }),
  );

  // ---------- get_test_plan ----------
  server.registerTool(
    "get_test_plan",
    {
      title: "Get a full QA test plan",
      description:
        "Return a full test plan: sections, cases (codes, steps, expected, tags, agentPrompt) and each case's result " +
        "(pass / fail / not_run + notes) for a run (default: latest), plus the list of runs and counts. Use this to read " +
        "an existing plan BEFORE updating it with upsert_test_plan so you keep existing section/case codes (which " +
        "preserves the tester's results).",
      inputSchema: {
        planId: z.number().int().positive().describe("Test plan id (see list_projects)"),
        runId: z.number().int().positive().optional().describe("Specific run id; defaults to the latest run"),
      },
      annotations: { readOnlyHint: true },
    },
    safe("get_test_plan", async ({ planId, runId }) => {
      const owned = await assertPlanOwner(userId, planId).catch(() => null);
      const plan = owned ? await getPlanFull(planId, runId) : null;
      if (!plan) return fail(`Plan ${planId} not found. Call list_projects to see valid plan ids.`);
      return ok({ ...plan, url: planUrl(plan.projectId, planId) });
    }),
  );

  return server;
}
