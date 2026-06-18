import fs from "node:fs";

const path = new URL("../server/.runtime-data/platform-state.json", import.meta.url);
if (!fs.existsSync(path)) {
  console.log("No platform state file found at", path.pathname);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(path, "utf8"));
const dateKeys = new Set([
  "createdAt",
  "updatedAt",
  "submittedAt",
  "launchedAt",
  "requestedAt",
  "resolvedAt",
  "paidAt",
  "occurredAt",
  "timestamp",
  "confirmedAt",
  "lastPaidAt",
  "lastTouchpointAt"
]);

const issues = [];

function visit(value, trail = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextTrail = `${trail}.${key}`;
    if (dateKeys.has(key) && child != null) {
      const parsed = new Date(child);
      if (Number.isNaN(parsed.getTime())) {
        issues.push({ path: nextTrail, value: child });
      }
    }
    visit(child, nextTrail);
  }
}

visit(data);

if (!issues.length) {
  console.log("✓ No malformed date strings found.");
  process.exit(0);
} else {
  console.error("✗ Found malformed dates:");
  console.error(JSON.stringify(issues, null, 2));
  process.exit(1);
}
