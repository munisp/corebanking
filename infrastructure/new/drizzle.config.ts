import { defineConfig } from "drizzle-kit";

// Drizzle Kit configuration for the 54Bank platform schema.
// Generates versioned SQL migrations from drizzle/schema.ts so the platform
// no longer depends solely on `drizzle push` for schema provisioning.
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/generated",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/54bank",
  },
  strict: true,
  verbose: true,
});
