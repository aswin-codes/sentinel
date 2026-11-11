import { authenticate, createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const user = await authenticate((await readJson(req)) as Parameters<typeof authenticate>[0]);
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  return ok({ user });
});
