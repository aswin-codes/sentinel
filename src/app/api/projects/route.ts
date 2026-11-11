import path from "node:path";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().nullish(),
  repoPath: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || path.isAbsolute(v), { message: "repoPath must be an absolute path" }),
});

export const GET = handle(async () => {
  const rows = await db.select().from(projects).orderBy(asc(projects.createdAt), asc(projects.id));
  return ok(rows);
});

export const POST = handle(async (req: Request) => {
  const input = projectInputSchema.parse(await readJson(req));
  const [row] = await db
    .insert(projects)
    .values({ name: input.name, description: input.description ?? null, repoPath: input.repoPath })
    .returning();
  return ok(row, 201);
});
