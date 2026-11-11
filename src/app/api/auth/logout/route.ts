import { cookies } from "next/headers";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/session";
import { handle, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const jar = await cookies();
  await deleteSession(jar.get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return ok({ ok: true });
});
