/**
 * Framework-agnostic auth core (used by Next route handlers AND the MCP server).
 * Relative imports only. Identity/sessions are handled by Clerk; Clerk-specific helpers live in ./session.ts.
 * Here: the local `users` row (owner of projects), personal API tokens and ownership guards.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../db";
import { apiTokens, projects, testPlans, testRuns, users } from "../db/schema";
import { NotFoundError } from "./plans";

export const API_TOKEN_PREFIX = "snt_";
/** Prefixes accepted when verifying (qah_ = tokens issued before the rename to Sentinel). */
export const API_TOKEN_PREFIXES = ["snt_", "qah_"] as const;
export const isApiToken = (t: string) => API_TOKEN_PREFIXES.some((p) => t.startsWith(p));

export type PublicUser = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export class UnauthorizedError extends Error {}
export class ConflictError extends Error {}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const publicCols = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  avatarUrl: users.avatarUrl,
};
const toPublic = (u: PublicUser): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  avatarUrl: u.avatarUrl,
});

// ---------- Users (mirrored from Clerk) ----------

export type ClerkUserInput = {
  clerkUserId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
};

/** Insert or update the local user for a Clerk user id. */
export async function upsertClerkUser(input: ClerkUserInput): Promise<PublicUser> {
  const values = {
    name: input.name.trim(),
    email: input.email ?? null,
    phone: input.phone ?? null,
    avatarUrl: input.avatarUrl ?? null,
  };
  // One-time migration: accounts created by the old email/password auth were
  // re-keyed to `legacy:<id>`. The first Clerk sign-in with the same (Clerk-verified)
  // email claims that row, so its projects, plans and tokens carry over.
  if (values.email && !(await getUserByClerkId(input.clerkUserId))) {
    const [claimed] = await db
      .update(users)
      .set({ clerkUserId: input.clerkUserId, ...values })
      .where(and(eq(users.email, values.email), like(users.clerkUserId, "legacy:%")))
      .returning(publicCols);
    if (claimed) return toPublic(claimed);
  }
  const [u] = await db
    .insert(users)
    .values({ clerkUserId: input.clerkUserId, ...values })
    .onConflictDoUpdate({ target: users.clerkUserId, set: values })
    .returning(publicCols);
  return toPublic(u);
}

export async function getUserByClerkId(clerkUserId: string): Promise<PublicUser | null> {
  const [u] = await db.select(publicCols).from(users).where(eq(users.clerkUserId, clerkUserId));
  return u ? toPublic(u) : null;
}

// ---------- API tokens ----------

export async function createApiToken(userId: number, name: string) {
  const token = API_TOKEN_PREFIX + randomBytes(24).toString("base64url");
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, name: name.trim() || "Agent token", tokenHash: sha256(token), prefix: token.slice(0, 10) })
    .returning();
  // Plaintext token is returned exactly once.
  return { id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt.toISOString(), token };
}

export async function listApiTokens(userId: number) {
  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeApiToken(userId: number, tokenId: number): Promise<void> {
  const [row] = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });
  if (!row) throw new NotFoundError(`Token ${tokenId} not found`);
}

export async function getUserByApiToken(token: string | undefined | null): Promise<PublicUser | null> {
  if (!token || !isApiToken(token)) return null;
  const [row] = await db
    .select({ tokenId: apiTokens.id, ...publicCols })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, sha256(token)));
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  return toPublic(row);
}

// ---------- Ownership guards (throw NotFoundError so we never leak existence) ----------

export async function assertProjectOwner(userId: number, projectId: number) {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!p) throw new NotFoundError(`Project ${projectId} not found`);
  return p;
}

export async function assertPlanOwner(userId: number, planId: number) {
  const [row] = await db
    .select({ planId: testPlans.id, projectId: testPlans.projectId })
    .from(testPlans)
    .innerJoin(projects, eq(projects.id, testPlans.projectId))
    .where(and(eq(testPlans.id, planId), eq(projects.userId, userId)));
  if (!row) throw new NotFoundError(`Plan ${planId} not found`);
  return row;
}

export async function assertRunOwner(userId: number, runId: number) {
  const [row] = await db
    .select({ runId: testRuns.id, planId: testRuns.planId })
    .from(testRuns)
    .innerJoin(testPlans, eq(testPlans.id, testRuns.planId))
    .innerJoin(projects, eq(projects.id, testPlans.projectId))
    .where(and(eq(testRuns.id, runId), eq(projects.userId, userId)));
  if (!row) throw new NotFoundError(`Run ${runId} not found`);
  return row;
}
