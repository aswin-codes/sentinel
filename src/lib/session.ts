/** Next.js-only auth helpers (Clerk + request headers). Not importable from mcp-server. */
import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  UnauthorizedError,
  isApiToken,
  getUserByApiToken,
  getUserByClerkId,
  upsertClerkUser,
  type PublicUser,
} from "./auth";

/** Pull the Clerk profile and mirror it into our `users` table. */
export async function syncCurrentUser(): Promise<PublicUser | null> {
  const cu = await currentUser();
  if (!cu) return null;
  const phone = cu.primaryPhoneNumber?.phoneNumber ?? cu.phoneNumbers[0]?.phoneNumber ?? null;
  const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress ?? null;
  const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim();
  return upsertClerkUser({
    clerkUserId: cu.id,
    name: cu.fullName?.trim() || fullName || phone || email || "User",
    email,
    phone,
    avatarUrl: cu.hasImage ? cu.imageUrl : null,
  });
}

/**
 * Current user from the Clerk session (server components / route handlers).
 * First visit lazily creates the local user row — no webhooks needed.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  return (await getUserByClerkId(userId)) ?? (await syncCurrentUser());
});

/** For pages: redirect to /sign-in when signed out. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For route handlers: `Authorization: Bearer snt_...` OR Clerk session. Throws UnauthorizedError. */
export async function requireRequestUser(req: Request): Promise<PublicUser> {
  const header = req.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  if (bearer && isApiToken(bearer)) {
    const user = await getUserByApiToken(bearer);
    if (user) return user;
    throw new UnauthorizedError("Invalid API token.");
  }
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Not signed in.");
  return user;
}
