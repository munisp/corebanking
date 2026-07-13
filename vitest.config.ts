import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@server": path.resolve(__dirname, "infrastructure/new/server"),
      "@db": path.resolve(__dirname, "infrastructure/new/drizzle"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "infrastructure/new/server/__tests__/**/*.test.ts",
      "infrastructure/new/server/**/*.test.ts",
    ],
    exclude: [
      "node_modules/**",
      // E2E tests require a running server + Playwright browser — run separately with `npm run test:e2e`
      "infrastructure/new/e2e/**/*.spec.ts",
      // Runtime integration test requires live DB connection
      "infrastructure/new/server/platform.runtime.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["infrastructure/new/server/**/*.ts"],
      exclude: [
        "infrastructure/new/server/__tests__/**",
        "infrastructure/new/server/**/*.test.ts",
        "infrastructure/new/server/_core/**",
      ],
    },
  },
});
