# QA Hub

A local-first manager for QA test plans. AI coding agents (Claude Code, Cursor, Antigravity, and others) **write** feature test plans through an MCP server or REST API. Humans **run** them in a web UI as Pass/Fail checklists. The agent can then read the failed cases, along with the tester's notes, and fix them.

Built with Next.js 15, PostgreSQL (Drizzle ORM), Tailwind CSS v4, and the Model Context Protocol SDK.

## Prerequisites

- Node.js 20+ (needed for `process.loadEnvFile`)
- PostgreSQL running locally, with an empty database (for example `createdb qahub`)

## Setup

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL
npm run db:push               # create tables
npm run db:seed               # optional: sample "Bombay Canvas" project + plan
npm run dev                   # http://localhost:3000
```

`.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qahub
```

## Agent workflow

1. **`list_projects`**: find the project whose `repoPath` matches your repo, and any existing plans.
2. **`inspect_repo_changes`**: get the branch, commit, status, diff stat and full diff (optionally against a `base` such as `main`).
3. **`get_test_plan`** (when updating an existing plan): read it so you keep the existing section and case codes.
4. **`upsert_test_plan`**: create or update the checklist. Plans are matched by `(projectId, planTitle)` or `planId`, so there are no duplicates. Cases with stable codes (`S1`, `A2`, …) keep their results.
5. **A human** opens the returned URL (`http://localhost:3000/?plan=<id>`) and marks each case Pass/Fail, with notes.
6. **`get_failed_test_cases`**: the agent reads the failures and notes, fixes the code, and asks for a re-test.

For example, you can ask your agent:
- *"Look at my changes on this branch and write a QA test plan in QA Hub."*
- *"Fix the failed QA checks in the Push Notifications test plan."*

### MCP tools

| Tool | Input | Purpose |
|---|---|---|
| `list_projects` | – | Projects (id, name, description, repoPath) with their plans |
| `inspect_repo_changes` | `{projectId, base?, maxChars?}` | Git branch/commit/status/diff stat/recent commits, plus the diff |
| `upsert_test_plan` | `PlanInput` (see `src/lib/plans.ts`) | Creates or updates a plan → `{planId, created, url, counts}` |
| `get_test_plan` | `{planId, runId?}` | Full plan with per-case results |
| `get_failed_test_cases` | `{planId, runId?}` | Failed cases with tester notes and agent prompts |

Tag conventions: `Terminal` = zinc, `Admin panel` = amber, `Phone` = sky, `Claude sets up` = violet. The allowed colors are `amber`, `violet`, `sky`, `emerald`, `rose` and `zinc`.

## MCP setup

The server is a stdio process: `mcp-server/index.ts`, run with `tsx`. It loads `.env` from the repo root itself, so it works from any working directory. Calling `node` on tsx's CLI directly avoids depending on `npx` and the shell's `PATH`.

> In the examples below, replace `D:/Projects/TestCaseManager` with the absolute path to your own clone. Forward slashes also work on Windows.

The PostgreSQL database must be reachable. The Next.js dev server only needs to be running when someone opens the plan URLs.

### Claude Code

```bash
claude mcp add qa-hub -- node D:/Projects/TestCaseManager/node_modules/tsx/dist/cli.mjs D:/Projects/TestCaseManager/mcp-server/index.ts
```

Add `--scope user` to make it available in every project. You can also add it as JSON, either in a project's `.mcp.json` or under `mcpServers` in `~/.claude.json`:

```json
{
  "mcpServers": {
    "qa-hub": {
      "command": "node",
      "args": [
        "D:/Projects/TestCaseManager/node_modules/tsx/dist/cli.mjs",
        "D:/Projects/TestCaseManager/mcp-server/index.ts"
      ]
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` to make it global, with the same `mcpServers` JSON as above.

### Antigravity

Open the MCP servers menu, choose **Manage MCP Servers**, then **View raw config**. This opens `mcp_config.json`, which uses the same `mcpServers` shape. Add the `qa-hub` entry shown above.

### Quick check

```bash
npm run mcp     # starts the server on stdio; logs go to stderr. Ctrl+C to stop.
```

## REST API

All endpoints take and return JSON. Errors are returned as `{ error: string, details?: unknown }` with the matching HTTP status.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/projects` | – | `Project[]` |
| POST | `/api/projects` | `{name, description?, repoPath?}` | `Project` (201) |
| GET | `/api/projects/[id]/git` | – | `GitInfo` |
| GET | `/api/plans?projectId=` | – | `PlanListItem[]` `{id,projectId,title,description,gitBranch,commitHash,status,updatedAt,counts}` (counts for latest run) |
| POST | `/api/plans` | `PlanInput` (see `src/lib/plans.ts`) | `PlanFull` (201 created / 200 updated) |
| GET | `/api/plans/[id]?runId=` | – | `PlanFull` |
| PATCH | `/api/plans/[id]` | `{title?, description?, status?, gitBranch?, commitHash?}` | `PlanFull` |
| POST | `/api/runs` | `{planId, name?}` | `RunSummary` (201) |
| POST | `/api/runs/[id]/reset` | – | `{ok:true}` |
| PATCH | `/api/results` | `{runId, caseId, status?, notes?}` | result row |

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server (http://localhost:3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push `src/db/schema.ts` to the database (Drizzle) |
| `npm run db:seed` | Seed the sample project and test plan |
| `npm run mcp` | Run the stdio MCP server |

## Project layout

```
src/db/          Drizzle schema, pg pool, seed
src/lib/         Shared services (plans, git) used by the API routes AND the MCP server
src/app/         Next.js UI + /api route handlers
src/components/  UI components
mcp-server/      Stdio MCP server
```
