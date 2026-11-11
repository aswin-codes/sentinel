import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qahub";

// Reuse one pool across Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { __qahubPool?: Pool };
const pool = globalForDb.__qahubPool ?? new Pool({ connectionString, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__qahubPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { pool, schema };
