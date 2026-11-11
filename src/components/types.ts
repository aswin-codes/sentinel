import type { CaseWithResult } from "@/lib/plans";

export type { PlanFull, SectionFull, CaseWithResult, RunSummary } from "@/lib/plans";
export type { GitInfo } from "@/lib/git";

export type ResultStatus = CaseWithResult["result"]["status"];

export type Counts = { total: number; pass: number; fail: number; notRun: number };

/** Shape of GET /api/projects items (JSON-serialized `projects` row). */
export type Project = {
  id: number;
  name: string;
  description: string | null;
  repoPath: string | null;
  createdAt: string;
};

/** Shape of GET /api/plans?projectId= items. */
export type PlanListItem = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  gitBranch: string | null;
  commitHash: string | null;
  status: string;
  updatedAt: string;
  counts: Counts;
};

export type Filter = "all" | "not_run" | "fail";
