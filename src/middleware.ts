import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk runs on every page and API route so `auth()` works server-side.
 * Only app pages are protected here (signed out → Clerk sign-in). API routes are NOT protected by
 * middleware: they also accept `Authorization: Bearer snt_...` and do their own check (requireRequestUser).
 */
const isProtectedPage = createRouteMatcher(["/projects(.*)", "/settings(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedPage(req)) await auth.protect();
  },
  // Our own sign-in/up pages (instead of Clerk's hosted Account Portal); env vars not required.
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    // Clerk auto-proxy on production *.vercel.app hosts (https://<app>.vercel.app/__clerk). Listed
    // explicitly because the static-file rule below would skip proxied assets like clerk.browser.js.
    "/__clerk/:path*",
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
