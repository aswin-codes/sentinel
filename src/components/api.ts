/** Tiny client-side fetch helper for the Sentinel REST API. */

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }

  /** Zod issues (`[{path, message}]`) → `{ field: message }` (first issue per field wins). */
  get fieldErrors(): FieldErrors {
    const out: FieldErrors = {};
    if (!Array.isArray(this.details)) return out;
    for (const issue of this.details) {
      if (!issue || typeof issue !== "object") continue;
      const { path, message } = issue as { path?: unknown; message?: unknown };
      const key = Array.isArray(path) && path.length ? String(path[0]) : "";
      if (key && typeof message === "string" && !(key in out)) out[key] = message;
    }
    return out;
  }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const obj = data && typeof data === "object" ? (data as { error?: unknown; details?: unknown }) : null;
    const msg = typeof obj?.error === "string" ? obj.error : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, obj?.details);
  }
  return data as T;
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
