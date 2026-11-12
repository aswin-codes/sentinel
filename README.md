# QA Hub

A self-hostable, multi-user manager for QA test plans. AI coding agents (Claude Code, Cursor, Antigravity, and others) **write** feature test plans through an MCP server or REST API using a personal API token. Humans **run** them in the web UI as Pass/Fail checklists. The agent can then read the failed cases, along with the tester's notes, and fix them.

Every account starts empty and only ever sees its own projects, plans, runs and tokens.

Built with Next.js 15, PostgreSQL (Drizzle ORM), Tailwind CSS v4, and the Model Context Protocol SDK.

## Prerequisites

- Node.js 20+ (needed for `process.loadEnvFile`)
- PostgreSQL, with an empty database (for example `createdb qahub`)
- A [Clerk](https://clerk.com) application for sign-in (optional for local development, see below)

## Setup

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL (+ Clerk keys)
npm run db:push               # create tables
npm run dev                   # http://localhost:3000
```

`.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qahub
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

## Authentication (Clerk)

Sign-in is handled by [Clerk](https://clerk.com). QA Hub allows exactly two sign-in methods: **Google** and **phone number (SMS code)**. The pages are `/sign-in` and `/sign-up`. After signing in you land on `/projects`. The old `/login` and `/signup` URLs redirect to them.

**Local development without a Clerk account (keyless mode).** Run `npx clerk@latest init`. It needs no Clerk account and writes temporary development keys, so you can sign in right away. A "Configure your application" prompt in the browser links to the page where you *claim* the instance. A keyless instance uses Clerk's defaults (email + password + Google). To restrict it to Google and phone, claim it (sign in to Clerk). It then becomes a normal app in your dashboard. Then follow steps 2–4 below. The `@clerk/nextjs` v7 SDK needs the keys present in the environment and won't start without them.

**Set up the Clerk application:**

1. In the [Clerk dashboard](https://dashboard.clerk.com), create an application (or claim the keyless one).
2. **Configure → User & authentication**:
   - **Email address**: turn off *Sign-up with email* and *Sign-in with email*, including verification code, verification link and password. Clerk may keep email as an optional profile attribute. It is just not used for sign-in.
   - **Phone number**: turn on *Sign-up with phone* and *Sign-in with phone*, with **SMS verification code**.
   - **Username**: off. **Password**: off.
3. **Configure → SSO connections**: enable **Google** and remove every other provider. Development instances use Clerk's shared Google credentials. For production, enter your own Google OAuth client ID and secret, using the redirect URI Clerk shows.
4. Under **API keys**, copy the keys into `.env` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, then restart `npm run dev`.

No other Clerk env vars are needed: the sign-in and sign-up URLs, and the redirect after sign-in (`/projects`), are set in code. Development instances send SMS only within a limited quota or to test numbers. Check Clerk's SMS pricing and supported countries before going to production.

**How it maps to QA Hub data.** Clerk owns identities and browser sessions. The first time a Clerk user opens the app, QA Hub creates a local `users` row (Clerk user id, name, email or phone, avatar). That row owns projects, plans and API tokens. Name, photo and sign-in methods are edited through **Settings → Manage account**, which opens Clerk's profile dialog. Agents never touch Clerk. They use personal `qah_...` API tokens.

## Getting started

1. Open http://localhost:3000/sign-up and continue with Google or your phone number.
2. **Create a project.** Give it a name and, ideally, the absolute path of the repo it tests (`repoPath`) so agents can read its git changes. Agents can also create projects themselves with the `create_project` MCP tool.
3. Go to **Settings → API tokens → Create token**. Copy the `qah_...` token. It is shown only once.
4. Add the MCP server to your agent with that token (see below), or call the REST API with `Authorization: Bearer qah_...`.

## MCP setup

The server is a stdio process: `mcp-server/index.ts`, run with `tsx`. It loads `.env` from the repo root itself, so it works from any working directory. Calling `node` on tsx's CLI directly avoids depending on `npx` and the shell's `PATH`.

It **requires** the `QA_HUB_TOKEN` env var. At startup it resolves the token to your account, and every tool is scoped to that account. With a missing or revoked token it prints an explanation to stderr and exits.

> In the examples below, replace `<ABS>` with the absolute path to your clone (for example `D:/Projects/TestCaseManager`; forward slashes work on Windows) and `qah_...` with your token.

Optional: set `QA_HUB_URL` (default `http://localhost:3000`) if the web UI runs elsewhere. It is used for the plan links the tools return.

The PostgreSQL database must be reachable from the MCP server. The Next.js server only needs to be running when someone opens the plan URLs.

### Claude Code

```bash
claude mcp add qa-hub -e QA_HUB_TOKEN=qah_... -- node <ABS>/node_modules/tsx/dist/cli.mjs <ABS>/mcp-server/index.ts
```

Add `--scope user` to make it available in every project. You can also add it as JSON, either in a project's `.mcp.json` or under `mcpServers` in `~/.claude.json`:

```json
{
  "mcpServers": {
    "qa-hub": {
      "command": "node",
      "args": [
        "<ABS>/node_modules/tsx/dist/cli.mjs",
        "<ABS>/mcp-server/index.ts"
      ],
      "env": { "QA_HUB_TOKEN": "qah_..." }
    }
  }
}
```

Don't commit a `.mcp.json` that contains your token.

### Cursor

Create `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` to make it global, with the same `mcpServers` JSON as above (including `env`).

### Antigravity

Open the MCP servers menu, choose **Manage MCP Servers**, then **View raw config**. This opens `mcp_config.json`, which uses the same `mcpServers` shape. Add the `qa-hub` entry shown above, including `env`.

### Quick check

```bash
QA_HUB_TOKEN=qah_... npm run mcp   # starts the server on stdio; logs go to stderr. Ctrl+C to stop.
```

## Agent workflow

1. **`list_projects`**: find your project whose `repoPath` matches the repo you are working in, and any existing plans.
2. **`create_project`** (if nothing matches): create one, passing the current working directory as `repoPath`.
3. **`inspect_repo_changes`**: get the branch, commit, status, diff stat and full diff (optionally against a `base` such as `main`).
4. **`get_test_plan`** (when updating an existing plan): read it so you keep the existing section and case codes.
5. **`upsert_test_plan`**: create or update the checklist. Plans are matched by `(projectId, planTitle)` or `planId`, so there are no duplicates. Cases with stable codes (`S1`, `A2`, …) keep their results.
6. **A human** opens the returned URL (`http://localhost:3000/projects/<projectId>/plans/<planId>`) and marks each case Pass/Fail, with notes.
7. **`get_failed_test_cases`**: the agent reads the failures and notes, fixes the code, and asks for a re-test.

For example, you can ask your agent:
- *"Look at my changes on this branch and write a QA test plan in QA Hub."*
- *"Fix the failed QA checks in the Push Notifications test plan."*

### MCP tools

| Tool | Input | Purpose |
|---|---|---|
| `list_projects` | – | Your projects (id, name, description, repoPath, url) with their plans |
| `create_project` | `{name, description?, repoPath?}` | Creates a project (use when `list_projects` has no match; `repoPath` = absolute repo path) |
| `inspect_repo_changes` | `{projectId, base?, maxChars?}` | Git branch/commit/status/diff stat/recent commits, plus the diff |
| `upsert_test_plan` | `PlanInput` (see `src/lib/plans.ts`) | Creates or updates a plan → `{planId, projectId, created, url, counts}` |
| `get_test_plan` | `{planId, runId?}` | Full plan with per-case results |
| `get_failed_test_cases` | `{planId, runId?}` | Failed cases with tester notes and agent prompts |

## REST API

All endpoints take and return JSON. Errors are returned as `{ error: string, details?: unknown }` with the matching HTTP status.

**Auth:** a signed-in Clerk browser session, or `Authorization: Bearer qah_...` (an API token from Settings → API tokens). Unauthenticated → 401. Resources that don't exist or belong to another user → 404. Validation errors → 400. Duplicates → 409.

```bash
curl -H "Authorization: Bearer qah_..." http://localhost:3000/api/projects
```

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/auth/me` | – | `{user}` `{id,name,email,phone,avatarUrl}` or 401 |
| GET | `/api/tokens` | – | `ApiTokenInfo[]` `{id,name,prefix,lastUsedAt,createdAt}` |
| POST | `/api/tokens` | `{name}` | `{id,name,prefix,createdAt,token}` 201 (token shown once) |
| DELETE | `/api/tokens/[id]` | – | `{ok:true}` |
| GET | `/api/projects` | – | `ProjectListItem[]` `{id,name,description,repoPath,createdAt,planCount,updatedAt}` (updatedAt = latest plan update or createdAt) |
| POST | `/api/projects` | `{name, description?, repoPath?}` | `Project` 201 |
| GET | `/api/projects/[id]` | – | `Project` |
| PATCH | `/api/projects/[id]` | `{name?, description?, repoPath?}` | `Project` |
| DELETE | `/api/projects/[id]` | – | `{ok:true}` (cascades) |
| GET | `/api/projects/[id]/git` | – | `GitInfo` |
| GET | `/api/plans?projectId=` | – | `PlanListItem[]` `{id,projectId,title,description,gitBranch,commitHash,status,updatedAt,latestRunId,counts}` |
| POST | `/api/plans` | `PlanInput` (`src/lib/plans.ts`) | `PlanFull` (201 created / 200 updated) |
| GET | `/api/plans/[id]?runId=` | – | `PlanFull` |
| PATCH | `/api/plans/[id]` | `{title?, description?, status?, gitBranch?, commitHash?}` | `PlanFull` |
| DELETE | `/api/plans/[id]` | – | `{ok:true}` |
| POST | `/api/runs` | `{planId, name?}` | `RunSummary` 201 |
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
| `npm run mcp` | Run the stdio MCP server (needs `QA_HUB_TOKEN`) |

## Project layout

```
src/db/          Drizzle schema + pg pool
src/lib/         Shared services (auth, plans, git) used by the API routes AND the MCP server
src/app/         Next.js UI + /api route handlers
src/components/  UI components
mcp-server/      Stdio MCP server
```
