import { z } from "zod";
import { createApiToken, listApiTokens } from "@/lib/auth";
import { requireRequestUser } from "@/lib/session";
import { handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenInputSchema = z.object({ name: z.string().trim().max(80).default("") });

export const GET = handle(async (req: Request) => {
  const user = await requireRequestUser(req);
  return ok(await listApiTokens(user.id));
});

export const POST = handle(async (req: Request) => {
  const user = await requireRequestUser(req);
  const { name } = tokenInputSchema.parse(await readJson(req));
  return ok(await createApiToken(user.id, name), 201);
});
