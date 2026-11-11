import type { CaseWithResult } from "@/lib/plans";

export type {
  PlanFull,
  SectionFull,
  CaseWithResult,
  RunSummary,
  PlanListItem,
  ProjectListItem,
} from "@/lib/plans";
export type { GitInfo } from "@/lib/git";
export type { PublicUser } from "@/lib/auth";

export type ResultStatus = CaseWithResult["result"]["status"];

export type Counts = { total: number; pass: number; fail: number; notRun: number };

/** JSON-serialized `projects` row as returned by the REST API. */
export type ProjectDTO = {
  id: number;
  name: string;
  description: string | null;
  repoPath: string | null;
  createdAt: string;
};

/** GET /api/tokens item. */
export type ApiTokenInfo = {
  id: number;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

/** POST /api/tokens response (token shown once). */
export type CreatedToken = { id: number; name: string; prefix: string; createdAt: string; token: string };

export type Filter = "all" | "not_run" | "fail";
