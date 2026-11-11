# QA Hub — AI Test Plan & Checklist Manager

Local-first Next.js app. AI coding agents create/update feature test plans (via MCP or REST);
humans execute them as Pass/Fail checklists.

## Stack
- Next.js 15 App Router, TypeScript (strict), Tailwind CSS v4, lucide-react
- **PostgreSQL** (local, `qahub` db) via `drizzle-orm/node-postgres` + `pg`
- `DATABASE_URL` lives in `.env` (gitignored). Next loads it automatically; the MCP server loads it with `process.loadEnvFile`.
- Zod for all validation. `@modelcontextprotocol/sdk` for the MCP server (run with `tsx`).

## Folder structure
```
src/
  db/schema.ts        Drizzle tables + relations (source of truth)
  db/index.ts         `db` (drizzle) + pg Pool singleton
  db/seed.ts          Seeds "Bombay Canvas" + "Push Notifications Test Plan"
  lib/plans.ts        SHARED service: zod input schemas, getPlanFull, upsertPlan, setResult, getFailedCases, ensureRun
  lib/git.ts          SHARED: getGitInfo / getGitDiff (execFile, no shell)
  lib/api.ts          Server helpers for route handlers (json/error responses)
  app/api/**          Route handlers (thin: validate → call lib → JSON)
  app/page.tsx        Main UI (client shell)
  components/**       UI components
mcp-server/index.ts   Stdio MCP server; imports ../src/lib/* and ../src/db (relative paths only)
```
**Rule:** `src/lib/*` and `src/db/*` must use relative imports (no `@/`), so `tsx` can run the MCP server. App code (`src/app`, `src/components`) may use `@/`.

## DB conventions
- Tables in snake_case (`test_plans`), TS fields in camelCase. Integer `serial` ids.
- `steps`/`expected` = `jsonb string[]`; `tags` = `jsonb {label,color}[]`.
- Results: `test_results` unique on `(run_id, case_id)`. **Missing row = `not_run`.**
- Plans unique on `(project_id, title)`; sections unique on `(plan_id, code)`; cases unique on `(section_id, code)`. Upserts match on these so case ids (and their results) survive agent re-upserts.
- Every plan has ≥1 run; "active run" = most recent unless `runId` is given.
- Schema changes: edit `schema.ts`, then `npm run db:push`.

## REST API contract (all JSON; errors are `{ error: string, details?: unknown }` with proper status)
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/projects` | – | `Project[]` |
| POST | `/api/projects` | `{name, description?, repoPath?}` | `Project` (201) |
| GET | `/api/projects/[id]/git` | – | `GitInfo` |
| GET | `/api/plans?projectId=` | – | `PlanListItem[]` `{id,projectId,title,description,gitBranch,commitHash,status,updatedAt,latestRunId,counts}` (counts for latest run) |
| POST | `/api/plans` | `PlanInput` (see lib/plans.ts) | `PlanFull` (201 created / 200 updated) |
| GET | `/api/plans/[id]?runId=` | – | `PlanFull` |
| PATCH | `/api/plans/[id]` | `{title?, description?, status?, gitBranch?, commitHash?}` | `PlanFull` |
| POST | `/api/runs` | `{planId, name?}` | `RunSummary` (201) |
| POST | `/api/runs/[id]/reset` | – | `{ok:true}` |
| PATCH | `/api/results` | `{runId, caseId, status?, notes?}` | result row |

Types `PlanFull`, `SectionFull`, `CaseWithResult`, `RunSummary` are exported from `src/lib/plans.ts` — UI imports them with `import type` from `@/lib/plans`.

## UI design tokens (dark developer UI)
Defined in `src/app/globals.css` under `@theme` so Tailwind classes like `bg-canvas` work.
| Token | Value | Use |
|---|---|---|
| canvas | `#0A0A0C` | page bg |
| surface | `#121215` | cards, bars |
| surface-2 | `#18181C` | inset panels (Expected box, inputs) |
| line | `#222228` | 1px hairline borders |
| fg | `#EDEDEF` | primary text |
| muted | `#8A8A93` | secondary text |
| accent | `#F59E0B` | section letters, focus rings |
| pass | `#10B981` | Pass |
| fail | `#EF4444` | Fail |
Fonts: Geist Sans (body), Geist Mono / JetBrains Mono (codes, commands, counters). Radius: 10px cards, 6px buttons, full pills.
Tag colors map a `color` name (`amber`,`violet`,`sky`,`emerald`,`rose`,`zinc`) to a soft bg + text pair.

## Commands
- `npm run dev` · `npm run build` · `npx tsc --noEmit`
- `npm run db:push` · `npm run db:seed`
- `npm run mcp` (stdio MCP server)
