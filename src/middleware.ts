import { NextResponse, type NextRequest } from "next/server";

// Keep in sync with SESSION_COOKIE in src/lib/auth.ts (not imported: middleware runs on the edge runtime).
const SESSION_COOKIE = "qahub_session";

/**
 * Cheap cookie-presence gate for app pages. The real session check happens server-side
 * (requireUser in the (app) layout). /login and /signup decide for themselves since the
 * cookie may be stale.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/projects", "/projects/:path*", "/settings", "/settings/:path*"],
};
