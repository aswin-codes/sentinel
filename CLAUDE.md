# Sentinel — AI Test Plan & Checklist Manager

Self-hostable, multi-user SaaS-style Next.js app. Users sign up, create projects, and AI coding agents
(Claude Code, Cursor, Antigravity) create/update feature test plans for those projects via MCP or REST
using a personal API token. Humans execute plans as Pass/Fail checklists. New accounts start EMPTY —
no demo/seed data anywhere.

## Stack
- Next.js 15 App Router, TypeScript (strict), Tailwind CSS v4, lucide-react
- **PostgreSQL** (`qahub` db) via `drizzle-orm/node-postgres` + `pg`
- `DATABASE_URL` in `.env` (gitignored). Next loads it; the MCP server loads it with `process.loadEnvFile`.
- Zod v4 for all validation. `@modelcontextprotocol/sdk` for the MCP server (run with `tsx`).
- Auth (humans): **Clerk** (`@clerk/nextjs` v7). Sign-in methods = Google + email (one-time code) only (free tier, no SMS), configured in the
  Clerk dashboard (not in code). Keys `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in `.env`/`.env.local` (required in v7;
  for dev, `npx clerk@latest init` writes temporary keyless keys). Local `users` row (keyed by `clerk_user_id`) is created lazily on first request — no webhooks.
- Auth (agents): personal API tokens `snt_...` (sha256 stored, shown once) — never Clerk.

## Folder structure
```
src/
  db/schema.ts          Drizzle tables + relations (source of truth)
  db/index.ts           `db` + pg Pool singleton
  lib/auth.ts           SHARED auth core (no Clerk imports): PublicUser, upsertClerkUser, getUserByClerkId, API tokens,
                        assertProjectOwner/assertPlanOwner/assertRunOwner, UnauthorizedError, ConflictError
  lib/session.ts        Next-only (Clerk): getCurrentUser (auth() → local user, lazy sync), syncCurrentUser,
                        requireUser (pages → redirect /sign-in), requireRequestUser(req) (Bearer snt_ token OR Clerk session)
  lib/plans.ts          SHARED plan service: zod input schemas, getPlanFull, upsertPlan, listPlans, setResult, ...
  lib/git.ts            SHARED: getGitInfo / getGitDiff (execFile, no shell)
  lib/api.ts            Route-handler helpers (ok/fail/handle/parseId/readJson)
  middleware.ts         clerkMiddleware: protects /projects(.*), /settings(.*); runs on /api (for auth()) but doesn't protect it
  app/
    page.tsx                                  Landing (signed out) / redirect → /projects (signed in)
    (auth)/sign-in/[[...sign-in]], (auth)/sign-up/[[...sign-up]]   Clerk <SignIn/> / <SignUp/> (logo above)
    login/, signup/                           Legacy URLs → redirect to /sign-in, /sign-up
    (app)/layout.tsx                          Authenticated shell (top nav, user menu) — calls requireUser()
    (app)/projects/page.tsx                   Projects dashboard
    (app)/projects/[projectId]/page.tsx       Project: plans list, repo/git, connect agent, settings
    (app)/projects/[projectId]/plans/[planId]/page.tsx   Plan run sheet (?run=)
    (app)/settings/page.tsx                   Profile + API tokens
    api/**                                    Route handlers (thin: auth → validate → lib → JSON)
  components/**         UI components
mcp-server/index.ts     Stdio MCP server; requires SENTINEL_TOKEN env; relative imports only
```
**Rule:** `src/lib/*` (except `session.ts`) and `src/db/*` use relative imports (no `@/`) so `tsx` can run the MCP server. App code may use `@/`.
**Rule:** every data access is scoped to the signed-in user via the `assert*Owner` guards. Foreign ids → 404 (never 403, don't leak existence).

## DB conventions
- Tables snake_case, TS fields camelCase, `serial` ids. `projects.user_id` → users (cascade).
- `users`: `clerk_user_id` unique; `email`/`phone`/`avatar_url` nullable (phone column kept for future use; unused while sign-in is Google + email). No password/session tables.
- `steps`/`expected` = `jsonb string[]`; `tags` = `jsonb {label,color}[]`.
- `test_results` unique on `(run_id, case_id)`. **Missing row = `not_run`.**
- Plans unique on `(project_id, title)`; sections on `(plan_id, code)`; cases on `(section_id, code)` — upserts preserve case ids and results.
- Every plan has ≥1 run; active run = most recent unless `runId` given.
- Schema changes: edit `schema.ts`, then `npm run db:push`.

## REST API contract
All JSON. Errors: `{ error: string, details?: unknown }`. Auth: Clerk session (browser) or `Authorization: Bearer snt_...`.
Unauthenticated → 401. Not owned / missing → 404. Validation → 400. Duplicate → 409.
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
| POST | `/api/plans` | `PlanInput` (lib/plans.ts) | `PlanFull` (201 created / 200 updated) |
| GET | `/api/plans/[id]?runId=` | – | `PlanFull` |
| PATCH | `/api/plans/[id]` | `{title?, description?, status?, gitBranch?, commitHash?}` | `PlanFull` |
| DELETE | `/api/plans/[id]` | – | `{ok:true}` |
| POST | `/api/runs` | `{planId, name?}` | `RunSummary` 201 |
| POST | `/api/runs/[id]/reset` | – | `{ok:true}` |
| PATCH | `/api/results` | `{runId, caseId, status?, notes?}` | result row |

Types (`PlanFull`, `SectionFull`, `CaseWithResult`, `RunSummary`, `PlanListItem`, `PublicUser`) come from `src/lib/plans.ts` / `src/lib/auth.ts` — client components import them with `import type` only.

## MCP
Config: `{"mcpServers":{"sentinel":{"command":"node","args":["<appDir>/node_modules/tsx/dist/cli.mjs","<appDir>/mcp-server/index.ts"],"env":{"SENTINEL_TOKEN":"snt_..."}}}}`.
Server resolves the user from `SENTINEL_TOKEN` at startup; every tool is scoped to that user.
Tools: list_projects, create_project, inspect_repo_changes, upsert_test_plan, get_test_plan, get_failed_test_cases.

## UI design — minimal
Neutral, quiet, lots of whitespace (think Linear settings pages / Vercel dashboard). Light AND dark via
`prefers-color-scheme` using CSS variables registered with Tailwind v4 `@theme` in `globals.css`.
Tokens: `bg` page, `surface` cards, `line` 1px hairlines, `fg`, `muted`, `subtle`. Color is reserved for
status only: `pass` (emerald) and `fail` (rose). No amber accents, no colored tag pills (tags render as
plain muted text/outline chips), no gradients, no shadows beyond a hairline. Geist Sans for UI,
Geist Mono only for case codes and inline code. 8px radius cards, 6px buttons. Max content width ~1100px.

## Commands
- `npm run dev` · `npm run build` · `npx tsc --noEmit` · `npm run lint`
- `npm run db:push`
- `npm run mcp` (stdio MCP server; needs `SENTINEL_TOKEN`)
