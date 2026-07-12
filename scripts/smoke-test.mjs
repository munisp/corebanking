import { spawn } from "node:child_process";
import process from "node:process";

const requestedBaseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, "") || null;
const baseUrl = requestedBaseUrl || "http://127.0.0.1:3000";
const maxAttempts = Number(process.env.SMOKE_MAX_ATTEMPTS || 20);
const waitMs = Number(process.env.SMOKE_WAIT_MS || 1500);

const checks = [
  {
    name: "health check",
    path: "/health",
    assert: async (response) => {
      if (response.status !== 200) {
        throw new Error(`Health check returned ${response.status}`);
      }
    },
  },
  {
    name: "platform overview",
    path: "/api/platform/overview",
    assert: async (response) => {
      const json = await response.json();
      if (!json.status || !json.timestamp) {
        throw new Error("overview payload is missing required fields");
      }
    },
  },
];

async function runSmokeTests() {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[${attempt}/${maxAttempts}] Running smoke tests...`);

    let allPassed = true;

    for (const check of checks) {
      try {
        const response = await fetch(`${baseUrl}${check.path}`);
        await check.assert(response);
        console.log(`  ✓ ${check.name}`);
      } catch (error) {
        if (attempt < maxAttempts) {
          console.log(`  ✗ ${check.name}: ${error.message} (retrying...)`);
          allPassed = false;
        } else {
          console.error(`  ✗ ${check.name}: ${error.message}`);
          allPassed = false;
        }
      }
    }

    if (allPassed) {
      console.log("✓ All smoke tests passed");
      process.exit(0);
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  console.error(`✗ Smoke tests failed after ${maxAttempts} attempts`);
  process.exit(1);
}

runSmokeTests();
