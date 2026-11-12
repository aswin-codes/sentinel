import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type Tag = { label: string; color: string };
export type ResultStatus = "not_run" | "pass" | "fail";
export type PlanStatus = "draft" | "active" | "archived";

/** Local owner of projects. Identity + sessions live in Clerk; synced lazily on first request. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").default("").notNull(),
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Personal API tokens for MCP / REST agents. Only sha256(token) is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    repoPath: text("repo_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const testPlans = pgTable(
  "test_plans",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    gitBranch: text("git_branch"),
    commitHash: text("commit_hash"),
    status: text("status").$type<PlanStatus>().default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("test_plans_project_title_uq").on(t.projectId, t.title)],
);

export const testSections = pgTable(
  "test_sections",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => testPlans.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").default(0).notNull(),
  },
  (t) => [uniqueIndex("test_sections_plan_code_uq").on(t.planId, t.code)],
);

export const testCases = pgTable(
  "test_cases",
  {
    id: serial("id").primaryKey(),
    sectionId: integer("section_id")
      .notNull()
      .references(() => testSections.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    steps: jsonb("steps").$type<string[]>().default([]).notNull(),
    expected: jsonb("expected").$type<string[]>().default([]).notNull(),
    tags: jsonb("tags").$type<Tag[]>().default([]).notNull(),
    agentPrompt: text("agent_prompt"),
    orderIndex: integer("order_index").default(0).notNull(),
  },
  (t) => [uniqueIndex("test_cases_section_code_uq").on(t.sectionId, t.code)],
);

export const testRuns = pgTable(
  "test_runs",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => testPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("test_runs_plan_idx").on(t.planId)],
);

export const testResults = pgTable(
  "test_results",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    caseId: integer("case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),
    status: text("status").$type<ResultStatus>().default("not_run").notNull(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("test_results_run_case_uq").on(t.runId, t.caseId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  apiTokens: many(apiTokens),
}));
export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  plans: many(testPlans),
}));
export const testPlansRelations = relations(testPlans, ({ one, many }) => ({
  project: one(projects, { fields: [testPlans.projectId], references: [projects.id] }),
  sections: many(testSections),
  runs: many(testRuns),
}));
export const testSectionsRelations = relations(testSections, ({ one, many }) => ({
  plan: one(testPlans, { fields: [testSections.planId], references: [testPlans.id] }),
  cases: many(testCases),
}));
export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  section: one(testSections, { fields: [testCases.sectionId], references: [testSections.id] }),
  results: many(testResults),
}));
export const testRunsRelations = relations(testRuns, ({ one, many }) => ({
  plan: one(testPlans, { fields: [testRuns.planId], references: [testPlans.id] }),
  results: many(testResults),
}));
export const testResultsRelations = relations(testResults, ({ one }) => ({
  run: one(testRuns, { fields: [testResults.runId], references: [testRuns.id] }),
  case: one(testCases, { fields: [testResults.caseId], references: [testCases.id] }),
}));
