import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BadRequestError, NotFoundError } from "./plans";
import { ConflictError, UnauthorizedError } from "./auth";

/** Error thrown inside handlers to produce a specific status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(status: number, error: string, details?: unknown) {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status });
}

/** Parse a positive integer id from a route/query param; throws HttpError(400) if invalid. */
export function parseId(param: string | null | undefined, name = "id"): number {
  const n = Number(param);
  if (!param || !/^\d+$/.test(param) || !Number.isSafeInteger(n) || n <= 0)
    throw new HttpError(400, `Invalid ${name}: ${param ?? "(missing)"}`);
  return n;
}

/** Read the JSON body; throws HttpError(400) on malformed JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function pgErrorCode(e: unknown): string | undefined {
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = err?.cause?.code ?? err?.code;
  return typeof code === "string" ? code : undefined;
}

/** Wrap a route handler: ZodError→400, UnauthorizedError→401, ConflictError→409, NotFoundError→404, HttpError→its status, unique violation→409, else 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return fail(400, "Invalid input", e.issues);
      if (e instanceof HttpError) return fail(e.status, e.message, e.details);
      if (e instanceof UnauthorizedError) return fail(401, e.message);
      if (e instanceof ConflictError) return fail(409, e.message);
      if (e instanceof NotFoundError) return fail(404, e.message);
      if (e instanceof BadRequestError) return fail(400, e.message);
      if (pgErrorCode(e) === "23505")
        return fail(409, "Conflict: a record with these unique fields already exists");
      console.error(e);
      return fail(500, e instanceof Error ? e.message : String(e));
    }
  };
}
