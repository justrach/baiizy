import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

const schema = { ...appSchema, ...authSchema };

const globalForDb = globalThis as unknown as {
  _db?: ReturnType<typeof createDb>;
};

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const clean = url
    .replace(/[?&]sslrootcert=[^&]*/g, "")
    .replace(/[?&]sslmode=[^&]*/g, "")
    .replace(/[?]$/, "");
  const needsSsl = url.includes("sslmode=") || url.includes("sslrootcert=") || url.includes("pg.psdb.cloud");
  return drizzle(postgres(clean, needsSsl ? { ssl: "require" } : {}), { schema });
}

export const db = globalForDb._db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb._db = db;
}
