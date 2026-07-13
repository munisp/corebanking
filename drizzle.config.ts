/**
 * Drizzle Kit Configuration — 54Bank Platform
 *
 * Enhanced configuration with:
 *   - strict: fails on destructive schema drift
 *   - verbose: logs every SQL statement
 *   - breakpoints: safe transaction boundaries in migrations
 *   - tablesFilter: prevents touching system/extension tables
 *   - migrations table: dedicated tracking table
 */
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is required.\n" +
    "Set it in your .env file: DATABASE_URL=postgres://user:pass@host:5432/dbname"
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
  strict: true,
  verbose: true,
  breakpoints: true,
  migrations: {
    table: "_drizzle_migrations",
    schema: "public",
  },
  tablesFilter: [
    "!spatial_ref_sys",
    "!geography_columns",
    "!geometry_columns",
    "!raster_columns",
    "!raster_overviews",
    "!_timescaledb_*",
    "!timescaledb_*",
  ],
});
