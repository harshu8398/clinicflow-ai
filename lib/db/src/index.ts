import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { type Logger } from "drizzle-orm/logger";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

class TelemetryLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    const globalStore = (globalThis as any).__drizzleQueryCounterStore;
    if (globalStore) {
      globalStore.count++;
    }
  }
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema, logger: new TelemetryLogger() });

export * from "./schema";
