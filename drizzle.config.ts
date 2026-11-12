import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { normalizeDatabaseUrl } from "./src/db/url";

if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: normalizeDatabaseUrl(process.env.DATABASE_URL!) },
});
