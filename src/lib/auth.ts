/**
 * Framework-agnostic auth core (used by Next route handlers AND the MCP server).
 * Relative imports only. Next-specific cookie helpers live in ./session.ts.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { apiTokens, projects, sessions, testPlans, testRuns, users } from "../db/schema";
import { NotFoundError } from "./plans";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "qahub_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const API_TOKEN_PREFIX = "qah_";

export type PublicUser = { id: number; email: string; name: string };

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export class UnauthorizedError extends Error {}
export class ConflictError extends Error {}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const toPublic = (u: { id: number; email: string; name: string }): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
});

// ---------- Passwords (scrypt, no native deps) ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

// ---------- Users ----------

export async function createUser(input: z.input<typeof signupSchema>): Promise<PublicUser> {
  const { name, email, password } = signupSchema.parse(input);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw new ConflictError("An account with this email already exists.");
  const [u] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning();
  return toPublic(u);
}

export async function authenticate(input: z.input<typeof loginSchema>): Promise<PublicUser> {
  const { email, password } = loginSchema.parse(input);
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || !(await verifyPassword(password, u.passwordHash)))
    throw new UnauthorizedError("Incorrect email or password.");
  return toPublic(u);
}

// ---------- Sessions ----------

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string | undefined | null): Promise<PublicUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
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
  if (!token || !token.startsWith(API_TOKEN_PREFIX)) return null;
  const [row] = await db
    .select({ tokenId: apiTokens.id, id: users.id, email: users.email, name: users.name })
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
