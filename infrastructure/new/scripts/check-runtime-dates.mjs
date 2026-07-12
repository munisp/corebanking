import fs from "node:fs";

const path = new URL("../server/.runtime-data/platform-state.json", import.meta.url);
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
  console.log("No malformed date strings found.");
} else {
  console.log(JSON.stringify(issues, null, 2));
}
