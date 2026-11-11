/** Next.js-only auth helpers (cookies / request headers). Not importable from mcp-server. */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  UnauthorizedError,
  getUserByApiToken,
  getUserBySessionToken,
  type PublicUser,
} from "./auth";

/** Current user from the session cookie (server components / actions). */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  return getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** For pages: redirect to /login when signed out. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: session cookie OR `Authorization: Bearer qah_...`. Throws UnauthorizedError. */
export async function requireRequestUser(req: Request): Promise<PublicUser> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const user = await getUserByApiToken(auth.slice(7).trim());
    if (user) return user;
    throw new UnauthorizedError("Invalid API token.");
  }
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Not signed in.");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.QA_HUB_INSECURE_COOKIE !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
