import { defineConfig } from "drizzle-kit";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is not set");

// Strip libpq-only params that drizzle-kit doesn't understand
const url = rawUrl
  .replace(/[?&]sslrootcert=[^&]*/g, "")
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?]$/, "");

export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url, ssl: true },
});
