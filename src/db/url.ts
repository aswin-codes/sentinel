/**
 * Normalise DATABASE_URL for node-postgres.
 *
 * pg v8 treats sslmode=prefer|require|verify-ca as aliases for verify-full and prints a
 * SECURITY WARNING on every connect (pg v9 will switch them to weaker libpq semantics).
 * Hosted Postgres (Neon, Supabase, ...) hands out `sslmode=require` URLs, so we make the
 * current, strict behaviour explicit: verify-full. Nothing changes for URLs without SSL,
 * or when the user opted into libpq semantics with `uselibpqcompat=true`.
 */
export function normalizeDatabaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const mode = url.searchParams.get("sslmode");
  if (
    mode &&
    ["prefer", "require", "verify-ca"].includes(mode) &&
    url.searchParams.get("uselibpqcompat") !== "true"
  ) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return raw;
}
